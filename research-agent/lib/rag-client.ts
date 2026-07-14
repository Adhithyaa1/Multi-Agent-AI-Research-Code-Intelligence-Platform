import { RAG_BACKEND_URL } from "./config";
import type { PipelineResult, ResearchNotes, RetrievedChunk } from "./types";

interface IngestResult {
  document_id: string;
  filename: string;
  chunk_count: number;
}

interface RetrieveResult {
  chunks: RetrievedChunk[];
}

export async function isRagBackendAvailable(
  options: { retries?: number; timeoutMs?: number } = {},
): Promise<boolean> {
  const { retries = 4, timeoutMs = 5000 } = options;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(`${RAG_BACKEND_URL}/health`, {
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // Backend may be reloading after a git clone — retry.
    }

    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }

  return false;
}

export async function ingestDocument(filePath: string): Promise<IngestResult> {
  const response = await fetch(`${RAG_BACKEND_URL}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_path: filePath }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(payload?.detail ?? "Document ingestion failed.");
  }

  return (await response.json()) as IngestResult;
}

export async function ingestDocumentUpload(file: File): Promise<IngestResult> {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const response = await fetch(`${RAG_BACKEND_URL}/ingest/upload`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(payload?.detail ?? "Document ingestion failed.");
  }

  return (await response.json()) as IngestResult;
}

export async function retrieveContext(
  documentId: string,
  query: string,
  topK = 4,
): Promise<RetrievedChunk[]> {
  const response = await fetch(`${RAG_BACKEND_URL}/retrieve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id: documentId,
      query,
      top_k: topK,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(payload?.detail ?? "Context retrieval failed.");
  }

  const result = (await response.json()) as RetrieveResult;
  return result.chunks;
}

export async function runResearchAgent(
  question: string,
  documentId?: string,
): Promise<ResearchNotes> {
  const response = await fetch(`${RAG_BACKEND_URL}/research`, {
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
    throw new Error(payload?.detail ?? "Research agent failed.");
  }

  return (await response.json()) as ResearchNotes;
}

export async function runMultiAgentPipeline(
  question: string,
  documentId?: string,
): Promise<PipelineResult> {
  const response = await fetch(`${RAG_BACKEND_URL}/pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      document_id: documentId,
    }),
    signal: AbortSignal.timeout(900_000),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(payload?.detail ?? "Multi-agent pipeline failed.");
  }

  return (await response.json()) as PipelineResult;
}

export function buildRagSystemPrompt(chunks: RetrievedChunk[]): string {
  const context = chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.text}`)
    .join("\n\n");

  return `You are a research assistant. Answer the user's question using ONLY the document context below.

Rules:
- Base your answer on the provided context.
- If the context does not contain enough information, say you cannot find it in the document.
- Do not invent facts that are not supported by the context.

Document context:
${context}`;
}
