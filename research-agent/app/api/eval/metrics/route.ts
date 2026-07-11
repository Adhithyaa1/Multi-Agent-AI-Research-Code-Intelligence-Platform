import { fetchEvalMetrics } from "@/lib/code-client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const metrics = await fetchEvalMetrics();
    return Response.json(metrics);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load metrics.";
    return Response.json({ error: message }, { status: 500 });
  }
}
