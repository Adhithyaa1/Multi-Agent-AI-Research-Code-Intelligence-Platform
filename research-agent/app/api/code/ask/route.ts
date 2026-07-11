import { askCodeRepo } from "@/lib/code-client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { repoId?: string; question?: string };

  try {
    body = (await req.json()) as { repoId?: string; question?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const repoId = body.repoId?.trim();
  const question = body.question?.trim();

  if (!repoId || !question) {
    return Response.json(
      { error: "repoId and question are required." },
      { status: 400 },
    );
  }

  try {
    const result = await askCodeRepo(repoId, question);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Code Q&A failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
