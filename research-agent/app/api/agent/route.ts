import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import {
  AGENT_SYSTEM_PROMPT,
  createAgentTools,
} from "@/lib/agent-tools";
import { OLLAMA_MODEL } from "@/lib/config";
import { getMessageText } from "@/lib/messages";
import { isOllamaAvailable } from "@/lib/ollama-health";
import { ollama } from "@/lib/ollama";
import { isRagBackendAvailable } from "@/lib/rag-client";
import type { ChatErrorResponse } from "@/lib/types";

const OLLAMA_SETUP_MESSAGE =
  "Ollama is not running. Install it from https://ollama.com/download, then run `ollama pull llama3.1`.";

const RAG_SETUP_MESSAGE =
  "RAG backend is not running. Start it with `uvicorn main:app --port 8000` in the backend/ folder.";

export const runtime = "nodejs";
export const maxDuration = 120;

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

  const { messages, documentId, repoId } = body as {
    messages: unknown;
    documentId?: unknown;
    repoId?: unknown;
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

  if (repoId !== undefined && typeof repoId !== "string") {
    return errorResponse("repoId must be a string.", "invalid_request", 400);
  }

  if (!(await isOllamaAvailable())) {
    return errorResponse(OLLAMA_SETUP_MESSAGE, "ollama_unavailable", 503);
  }

  if (!(await isRagBackendAvailable())) {
    return errorResponse(RAG_SETUP_MESSAGE, "rag_unavailable", 503);
  }

  const tools = createAgentTools({
    documentId: typeof documentId === "string" ? documentId : undefined,
    repoId: typeof repoId === "string" ? repoId : undefined,
  });

  const contextHints: string[] = [];
  if (documentId) {
    contextHints.push("A document is loaded for searchDocuments.");
  }
  if (repoId) {
    contextHints.push("A code repository is loaded for searchCodeRepo.");
  }
  if (contextHints.length === 0) {
    contextHints.push(
      "No document or repo is loaded yet. Guide the user to upload a file or import a repository.",
    );
  }

  try {
    const result = streamText({
      model: ollama(OLLAMA_MODEL),
      system: `${AGENT_SYSTEM_PROMPT}\n\nContext:\n${contextHints.join("\n")}`,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
      maxRetries: 0,
      onFinish: ({ text }) => {
        if (!text && messages.length > 0) {
          const lastUser = [...messages]
            .reverse()
            .find((message) => message.role === "user");
          if (lastUser) {
            console.info(
              "[api/agent] Finished with empty text for:",
              getMessageText(lastUser).slice(0, 80),
            );
          }
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[api/agent] Agent stream failed:", error);

    if (isOllamaConnectionError(error)) {
      return errorResponse(OLLAMA_SETUP_MESSAGE, "ollama_unavailable", 503);
    }

    return errorResponse(
      "The agent service failed unexpectedly.",
      "server_error",
      500,
    );
  }
}
