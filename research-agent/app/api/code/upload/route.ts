import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { registerCodeRepo } from "@/lib/code-client";
import type { CodeRepoInfo } from "@/lib/types";

export const runtime = "nodejs";

const CODE_EXTENSIONS = new Set([
  ".py", ".js", ".ts", ".tsx", ".jsx", ".md", ".txt", ".json",
  ".yaml", ".yml", ".rs", ".go", ".java", ".cpp", ".c", ".h", ".cs",
]);

function isCodeFile(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  return CODE_EXTENSIONS.has(ext);
}

function safeRelativePath(raw: string): string {
  return raw.replace(/\\/g, "/").replace(/^(\.\/)+/, "").replace(/\.\./g, "_");
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

  const repoId = `${Date.now()}-code`;
  const repoDir = path.join(process.cwd(), "uploads", "code", repoId);
  await mkdir(repoDir, { recursive: true });

  let projectName = "uploaded-project";

  for (const file of codeFiles.slice(0, 40)) {
    const relativePath = safeRelativePath(
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name,
    );
    if (relativePath.includes("/")) {
      projectName = relativePath.split("/")[0] ?? projectName;
    }
    const target = path.join(repoDir, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(target, buffer);
  }

  try {
    const repo: CodeRepoInfo = await registerCodeRepo(repoDir, projectName);
    return Response.json(repo);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Code ingest failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
