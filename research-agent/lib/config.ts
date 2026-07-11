export const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "uploads";

export const RAG_BACKEND_URL =
  process.env.RAG_BACKEND_URL ?? "http://localhost:8000";

/** Client-side URL for streaming pipeline (bypasses Next.js timeout). */
export const PUBLIC_RAG_BACKEND_URL =
  process.env.NEXT_PUBLIC_RAG_BACKEND_URL ?? "http://localhost:8000";

export const SUPPORTED_UPLOAD_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
] as const;

export const SUPPORTED_UPLOAD_EXTENSIONS = [".pdf", ".md", ".txt"] as const;

