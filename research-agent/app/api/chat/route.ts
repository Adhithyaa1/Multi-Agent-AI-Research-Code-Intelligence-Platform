import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { OLLAMA_MODEL } from "@/lib/config";
import { getMessageText } from "@/lib/messages";
import { isOllamaAvailable } from "@/lib/ollama-health";
import { ollama } from "@/lib/ollama";
import {
  buildRagSystemPrompt,
  isRagBackendAvailable,
  retrieveContext,
} from "@/lib/rag-client";
import type { ChatErrorResponse } from "@/lib/types";

const OLLAMA_SETUP_MESSAGE =
  "Ollama is not running. Install it from https://ollama.com/download, then run `ollama pull llama3.1`.";

const RAG_SETUP_MESSAGE =
  "RAG backend is not running. Start it with `uvicorn main:app --port 8000` in the backend/ folder.";

export const runtime = "nodejs";
export const maxDuration = 60;

function isUIMessageArray(value: unknown): value is UIMessage[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every(
    (message) =>
      message &&
      typeof message === "object" &&
      "role" in message &&
      "parts" in message &&
      Array.isArray((message as UIMessage).parts),
  );
}

function errorResponse(
  error: string,
  code: ChatErrorResponse["code"],
  status: number,
): Response {
  return Response.json({ error, code } satisfies ChatErrorResponse, {
    status,
  });
}

function isOllamaConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("econnrefused") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("connect")
  );
}

function getLastUserMessage(messages: UIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user") {
      return getMessageText(message);
    }
  }

  return "";
}

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body.", "invalid_request", 400);
  }

  if (!body || typeof body !== "object" || !("messages" in body)) {
    return errorResponse(
      'Request body must include a "messages" array.',
      "invalid_request",
      400,
    );
  }

  const { messages, documentId } = body as {
    messages: unknown;
    documentId?: unknown;
  };

  if (!isUIMessageArray(messages) || messages.length === 0) {
    return errorResponse(
      "Messages must be a non-empty array of chat messages.",
      "invalid_request",
      400,
    );
  }

  if (documentId !== undefined && typeof documentId !== "string") {
    return errorResponse("documentId must be a string.", "invalid_request", 400);
  }

  if (!(await isOllamaAvailable())) {
    return errorResponse(OLLAMA_SETUP_MESSAGE, "ollama_unavailable", 503);
  }

  let system: string | undefined;

  if (documentId) {
    if (!(await isRagBackendAvailable())) {
      return errorResponse(RAG_SETUP_MESSAGE, "rag_unavailable", 503);
    }

    const query = getLastUserMessage(messages);

    if (!query) {
      return errorResponse(
        "A user message is required for document Q&A.",
        "invalid_request",
        400,
      );
    }

    try {
      const chunks = await retrieveContext(documentId, query);
      system = buildRagSystemPrompt(chunks);
    } catch (error) {
      console.error("[api/chat] Retrieval failed:", error);
      return errorResponse(
        "Failed to retrieve document context.",
        "server_error",
        500,
      );
    }
  }

  try {
    const result = streamText({
      model: ollama(OLLAMA_MODEL),
      system,
      messages: await convertToModelMessages(messages),
      maxRetries: 0,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[api/chat] Failed to reach Ollama:", error);

    if (isOllamaConnectionError(error)) {
      return errorResponse(OLLAMA_SETUP_MESSAGE, "ollama_unavailable", 503);
    }

    return errorResponse(
      "The chat service failed unexpectedly.",
      "server_error",
      500,
    );
  }
}
