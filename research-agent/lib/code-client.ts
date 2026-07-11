import { RAG_BACKEND_URL } from "./config";
import type {
  CodeAnalysisResult,
  CodeAskResult,
  CodeRepoInfo,
  EvalMetrics,
  RepoMapResult,
} from "./types";

interface CodeIngestPayload {
  repo_id: string;
  name: string;
  file_count: number;
  files: string[];
}

export async function registerCodeRepo(
  repoPath: string,
  name?: string,
): Promise<CodeRepoInfo> {
  const response = await fetch(`${RAG_BACKEND_URL}/code/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_path: repoPath, name }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(payload?.detail ?? "Code repository ingest failed.");
  }

  const result = (await response.json()) as CodeIngestPayload;
  return {
    repoId: result.repo_id,
    name: result.name,
    fileCount: result.file_count,
    files: result.files,
  };
}

export async function fetchRepoMap(repoId: string): Promise<RepoMapResult> {
  const response = await fetch(`${RAG_BACKEND_URL}/code/map`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_id: repoId }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(payload?.detail ?? "Repository map failed.");
  }

  return (await response.json()) as RepoMapResult;
}

export async function analyzeCodeFile(
  repoId: string,
  file: string,
  mode: "explain" | "bugs" | "improve",
  question?: string,
): Promise<CodeAnalysisResult> {
  const response = await fetch(`${RAG_BACKEND_URL}/code/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repo_id: repoId,
      file,
      mode,
      question,
    }),
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(payload?.detail ?? "Code analysis failed.");
  }

  return (await response.json()) as CodeAnalysisResult;
}

export async function importGithubRepo(url: string): Promise<CodeRepoInfo> {
  const response = await fetch(`${RAG_BACKEND_URL}/code/github`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(payload?.detail ?? "GitHub import failed.");
  }

  const result = (await response.json()) as CodeIngestPayload;
  return {
    repoId: result.repo_id,
    name: result.name,
    fileCount: result.file_count,
    files: result.files,
  };
}

export async function indexCodeRepo(repoId: string): Promise<{
  repo_id: string;
  indexed_chunks: number;
  indexed_files: number;
}> {
  const response = await fetch(`${RAG_BACKEND_URL}/code/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_id: repoId }),
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(payload?.detail ?? "Code indexing failed.");
  }

  return (await response.json()) as {
    repo_id: string;
    indexed_chunks: number;
    indexed_files: number;
  };
}

export async function askCodeRepo(
  repoId: string,
  question: string,
): Promise<CodeAskResult> {
  const response = await fetch(`${RAG_BACKEND_URL}/code/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_id: repoId, question }),
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(payload?.detail ?? "Code Q&A failed.");
  }

  return (await response.json()) as CodeAskResult;
}

export async function fetchEvalMetrics(): Promise<EvalMetrics> {
  const response = await fetch(`${RAG_BACKEND_URL}/eval/metrics`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(payload?.detail ?? "Failed to load evaluation metrics.");
  }

  return (await response.json()) as EvalMetrics;
}
