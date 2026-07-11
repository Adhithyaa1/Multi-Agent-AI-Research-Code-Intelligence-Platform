import { analyzeCodeFile } from "@/lib/code-client";
import { ensureBackendAvailable } from "@/lib/backend-health";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { repoId, file, mode, question } = body as {
    repoId?: unknown;
    file?: unknown;
    mode?: unknown;
    question?: unknown;
  };

  if (typeof repoId !== "string" || !repoId.trim()) {
    return Response.json({ error: "repoId is required." }, { status: 400 });
  }

  if (typeof file !== "string" || !file.trim()) {
    return Response.json({ error: "file is required." }, { status: 400 });
  }

  if (mode !== "explain" && mode !== "bugs" && mode !== "improve") {
    return Response.json(
      { error: "mode must be explain, bugs, or improve." },
      { status: 400 },
    );
  }

  const unavailable = await ensureBackendAvailable();
  if (unavailable) {
    return unavailable;
  }

  try {
    const result = await analyzeCodeFile(
      repoId.trim(),
      file.trim(),
      mode,
      typeof question === "string" ? question : undefined,
    );
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Code analysis failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
