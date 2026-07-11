import { isOllamaAvailable } from "@/lib/ollama-health";
import { isRagBackendAvailable } from "@/lib/rag-client";

export const runtime = "nodejs";

export async function GET() {
  const [ollama, rag] = await Promise.all([
    isOllamaAvailable(),
    isRagBackendAvailable(),
  ]);

  const status = ollama && rag ? "ok" : "degraded";

  return Response.json(
    {
      status,
      services: {
        ollama,
        rag_backend: rag,
      },
      timestamp: new Date().toISOString(),
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
