import { importGithubRepo } from "@/lib/code-client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { url?: string };

  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return Response.json({ error: "GitHub URL is required." }, { status: 400 });
  }

  try {
    const repo = await importGithubRepo(url);
    return Response.json(repo);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "GitHub import failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
