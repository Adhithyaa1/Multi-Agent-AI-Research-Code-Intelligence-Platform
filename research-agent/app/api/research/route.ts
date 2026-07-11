import {
  isRagBackendAvailable,
  runResearchAgent,
} from "@/lib/rag-client";
import type { ChatErrorResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 180;

function errorResponse(
  error: string,
  code: ChatErrorResponse["code"],
  status: number,
): Response {
  return Response.json({ error, code } satisfies ChatErrorResponse, {
    status,
  });
}

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body.", "invalid_request", 400);
  }

  if (!body || typeof body !== "object" || !("question" in body)) {
    return errorResponse(
      'Request body must include a "question" string.',
      "invalid_request",
      400,
    );
  }

  const { question, documentId } = body as {
    question: unknown;
    documentId?: unknown;
  };

  if (typeof question !== "string" || !question.trim()) {
    return errorResponse("Question must be a non-empty string.", "invalid_request", 400);
  }

  if (documentId !== undefined && typeof documentId !== "string") {
    return errorResponse("documentId must be a string.", "invalid_request", 400);
  }

  if (!(await isRagBackendAvailable())) {
    return errorResponse(
      "Backend is not running. Start it with `uvicorn main:app --port 8000` in backend/.",
      "rag_unavailable",
      503,
    );
  }

  try {
    const notes = await runResearchAgent(question.trim(), documentId);
    return Response.json(notes);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Research agent failed.";

    if (message.toLowerCase().includes("ollama")) {
      return errorResponse(message, "ollama_unavailable", 503);
    }

    return errorResponse(message, "server_error", 500);
  }
}
