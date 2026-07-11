import { ensureBackendAvailable } from "@/lib/backend-health";
import { fetchRepoMap } from "@/lib/code-client";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { repoId } = body as { repoId?: unknown };

  if (typeof repoId !== "string" || !repoId.trim()) {
    return Response.json({ error: "repoId is required." }, { status: 400 });
  }

  const unavailable = await ensureBackendAvailable();
  if (unavailable) {
    return unavailable;
  }

  try {
    const map = await fetchRepoMap(repoId.trim());
    return Response.json(map);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Repo map failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
