import { RAG_BACKEND_URL } from "@/lib/config";
import type { CodeRepoInfo } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const CODE_EXTENSIONS = new Set([
  ".py", ".js", ".ts", ".tsx", ".jsx", ".md", ".txt", ".json",
  ".yaml", ".yml", ".rs", ".go", ".java", ".cpp", ".c", ".h", ".cs",
]);

function isCodeFile(name: string): boolean {
  const ext = name.includes(".") ? `.${name.split(".").pop()?.toLowerCase()}` : "";
  return CODE_EXTENSIONS.has(ext);
}

export async function POST(req: Request) {
  let formData: FormData;

  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const entries = formData.getAll("files");
  const files = entries.filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return Response.json({ error: "No files provided." }, { status: 400 });
  }

  const codeFiles = files.filter((file) => isCodeFile(file.name));
  if (codeFiles.length === 0) {
    return Response.json(
      { error: "No supported code files (.py, .js, .ts, etc.)." },
      { status: 400 },
    );
  }

  const outbound = new FormData();
  for (const file of codeFiles.slice(0, 40)) {
    const relativePath =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name;
    outbound.append("files", file, relativePath);
  }

  try {
    const response = await fetch(`${RAG_BACKEND_URL}/code/upload`, {
      method: "POST",
      body: outbound,
      signal: AbortSignal.timeout(300_000),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        detail?: string;
      } | null;
      throw new Error(payload?.detail ?? "Code upload failed.");
    }

    const result = (await response.json()) as {
      repo_id: string;
      name: string;
      file_count: number;
      files: string[];
    };

    const repo: CodeRepoInfo = {
      repoId: result.repo_id,
      name: result.name,
      fileCount: result.file_count,
      files: result.files,
    };
    return Response.json(repo);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Code upload failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
