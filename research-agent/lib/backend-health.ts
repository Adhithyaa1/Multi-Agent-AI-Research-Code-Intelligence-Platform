import { isRagBackendAvailable } from "@/lib/rag-client";

export const BACKEND_UNAVAILABLE_MESSAGE =
  "Python backend is unavailable. It may be restarting after a GitHub import — wait a few seconds and retry. Start it with .\\run-dev.ps1 in the backend folder (not plain uvicorn --reload).";

export async function ensureBackendAvailable(): Promise<Response | null> {
  const available = await isRagBackendAvailable({
    retries: 5,
    timeoutMs: 6000,
  });

  if (!available) {
    return Response.json({ error: BACKEND_UNAVAILABLE_MESSAGE }, { status: 503 });
  }

  return null;
}
