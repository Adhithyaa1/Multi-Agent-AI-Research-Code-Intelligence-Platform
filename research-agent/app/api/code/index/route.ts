import { indexCodeRepo } from "@/lib/code-client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { repoId?: string };

  try {
    body = (await req.json()) as { repoId?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const repoId = body.repoId?.trim();
  if (!repoId) {
    return Response.json({ error: "repoId is required." }, { status: 400 });
  }

  try {
    const result = await indexCodeRepo(repoId);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Code indexing failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
