import { tool } from "ai";
import { z } from "zod";
import { RAG_BACKEND_URL } from "./config";
import { retrieveContext, runResearchAgent } from "./rag-client";
import type { RetrievedChunk } from "./types";

export interface AgentToolContext {
  documentId?: string;
  repoId?: string;
}

function trimChunks(chunks: RetrievedChunk[], maxChars = 600) {
  return chunks.map((chunk) => ({
    text:
      chunk.text.length > maxChars
        ? `${chunk.text.slice(0, maxChars)}…`
        : chunk.text,
    score: chunk.score,
    metadata: chunk.metadata,
  }));
}

async function retrieveCodeChunks(
  repoId: string,
  query: string,
  topK = 5,
): Promise<RetrievedChunk[]> {
  const response = await fetch(`${RAG_BACKEND_URL}/code/retrieve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repo_id: repoId,
      query,
      top_k: topK,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(payload?.detail ?? "Code retrieval failed.");
  }

  const result = (await response.json()) as { chunks: RetrievedChunk[] };
  return result.chunks;
}

export function createAgentTools(context: AgentToolContext) {
  return {
    searchDocuments: tool({
      description:
        "Search the uploaded document for relevant passages. Use when the user asks about papers, PDFs, or uploaded text.",
      inputSchema: z.object({
        query: z.string().describe("Semantic search query for the document"),
      }),
      execute: async ({ query }) => {
        if (!context.documentId) {
          return {
            found: false,
            message:
              "No document is loaded. Ask the user to upload a PDF or text file first.",
          };
        }

        const chunks = await retrieveContext(context.documentId, query);
        return {
          found: chunks.length > 0,
          chunk_count: chunks.length,
          chunks: trimChunks(chunks),
        };
      },
    }),

    searchCodeRepo: tool({
      description:
        "Search an indexed code repository for relevant files and snippets. Use for architecture, implementation, or bug questions about code.",
      inputSchema: z.object({
        query: z.string().describe("Semantic search query for the codebase"),
      }),
      execute: async ({ query }) => {
        if (!context.repoId) {
          return {
            found: false,
            message:
              "No code repository is loaded. Ask the user to import or upload a repo and click Index for Q&A.",
          };
        }

        try {
          const chunks = await retrieveCodeChunks(context.repoId, query);
          return {
            found: chunks.length > 0,
            chunk_count: chunks.length,
            chunks: trimChunks(chunks),
          };
        } catch (error) {
          return {
            found: false,
            message:
              error instanceof Error
                ? error.message
                : "Code search failed. The repo may need indexing first.",
          };
        }
      },
    }),

    getResearchNotes: tool({
      description:
        "Generate structured research notes with concepts, evidence, limitations, and future work. Use for research-style questions.",
      inputSchema: z.object({
        question: z
          .string()
          .describe("Research question to analyze into structured notes"),
      }),
      execute: async ({ question }) => {
        const notes = await runResearchAgent(question, context.documentId);
        return notes;
      },
    }),
  };
}

export const AGENT_SYSTEM_PROMPT = `You are a research and code intelligence assistant with access to tools.

When answering:
- Use searchDocuments when a document is available and the question is about uploaded papers or files.
- Use searchCodeRepo when a code repository is indexed and the question is about implementation or architecture.
- Use getResearchNotes for structured research summaries with evidence and limitations.
- You may call multiple tools before giving a final answer.
- Cite which tool results you used.
- If tools report nothing is loaded, tell the user what to upload or index.
- Do not invent facts not supported by tool results.`;
