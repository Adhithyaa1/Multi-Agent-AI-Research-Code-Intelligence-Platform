import { PUBLIC_RAG_BACKEND_URL } from "./config";
import type { AgentTraceStep, PipelineResult } from "./types";

type StreamEvent =
  | { type: "step"; step: AgentTraceStep }
  | { type: "done"; result: PipelineResult }
  | { type: "error"; error: string };

export async function streamMultiAgentPipeline(
  question: string,
  documentId: string | undefined,
  onStep: (step: AgentTraceStep) => void,
): Promise<PipelineResult> {
  const response = await fetch(`${PUBLIC_RAG_BACKEND_URL}/pipeline/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      document_id: documentId,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(payload?.detail ?? "Multi-agent pipeline failed to start.");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response stream from pipeline.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) {
        continue;
      }

      const payload = JSON.parse(line.slice(6)) as StreamEvent;

      if (payload.type === "step") {
        onStep(payload.step);
      }

      if (payload.type === "error") {
        throw new Error(payload.error);
      }

      if (payload.type === "done") {
        return payload.result;
      }
    }
  }

  throw new Error(
    "Pipeline ended unexpectedly. Ensure Ollama is running and the backend is on port 8000.",
  );
}
