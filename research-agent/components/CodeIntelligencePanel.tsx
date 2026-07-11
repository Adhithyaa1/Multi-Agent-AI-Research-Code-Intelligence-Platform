"use client";

import { useEffect, useState, type FormEvent } from "react";
import type {
  ActiveRepo,
  CodeAnalysisResult,
  CodeAskResult,
  CodeRepoInfo,
  RepoMapResult,
} from "@/lib/types";

type AnalyzeMode = "explain" | "bugs" | "improve";

const MODE_LABELS: Record<AnalyzeMode, string> = {
  explain: "Explain",
  bugs: "Find bugs",
  improve: "Improve",
};

async function loadRepoMap(repoId: string): Promise<RepoMapResult> {
  const mapResponse = await fetch("/api/code/map", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoId }),
  });

  if (!mapResponse.ok) {
    const payload = (await mapResponse.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? "Repository map failed.");
  }

  return (await mapResponse.json()) as RepoMapResult;
}

function toCodeRepoInfo(active: ActiveRepo): CodeRepoInfo {
  return {
    repoId: active.repoId,
    name: active.name,
    fileCount: active.fileCount,
    files: active.files,
  };
}

export function CodeIntelligencePanel({
  activeRepo,
  onRepoChange,
  embedded = false,
}: {
  activeRepo: ActiveRepo | null;
  onRepoChange?: (repo: ActiveRepo | null) => void;
  embedded?: boolean;
}) {
  const [repo, setRepo] = useState<CodeRepoInfo | null>(
    activeRepo ? toCodeRepoInfo(activeRepo) : null,
  );
  const [repoMap, setRepoMap] = useState<RepoMapResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>(
    activeRepo?.files[0] ?? "",
  );
  const [mode, setMode] = useState<AnalyzeMode>("explain");
  const [analysis, setAnalysis] = useState<CodeAnalysisResult | null>(null);
  const [repoQuestion, setRepoQuestion] = useState("");
  const [askResult, setAskResult] = useState<CodeAskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMapping, setIsMapping] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [mappedRepoId, setMappedRepoId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRepo) {
      setRepo(null);
      setRepoMap(null);
      setSelectedFile("");
      setAnalysis(null);
      setAskResult(null);
      setMappedRepoId(null);
      return;
    }

    const next = toCodeRepoInfo(activeRepo);
    setRepo(next);
    setSelectedFile((current) =>
      next.files.includes(current) ? current : (next.files[0] ?? ""),
    );

    if (mappedRepoId === activeRepo.repoId) {
      return;
    }

    let cancelled = false;
    setIsMapping(true);
    setError(null);

    void loadRepoMap(activeRepo.repoId)
      .then((map) => {
        if (!cancelled) {
          setRepoMap(map);
          setMappedRepoId(activeRepo.repoId);
        }
      })
      .catch((mapError: unknown) => {
        if (!cancelled) {
          setError(
            mapError instanceof Error
              ? mapError.message
              : "Repository map failed.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsMapping(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeRepo, mappedRepoId]);

  const handleIndex = async () => {
    if (!activeRepo || isIndexing) {
      return;
    }

    setIsIndexing(true);
    setError(null);

    try {
      const response = await fetch("/api/code/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId: activeRepo.repoId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Indexing failed.");
      }

      const result = (await response.json()) as { indexed_chunks: number };
      onRepoChange?.({
        ...activeRepo,
        indexed: true,
        indexedChunks: result.indexed_chunks,
      });
    } catch (indexError) {
      setError(
        indexError instanceof Error ? indexError.message : "Indexing failed.",
      );
    } finally {
      setIsIndexing(false);
    }
  };

  const handleAsk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!repo || !repoQuestion.trim() || isAsking) {
      return;
    }

    setIsAsking(true);
    setError(null);
    setAskResult(null);

    try {
      const response = await fetch("/api/code/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoId: repo.repoId,
          question: repoQuestion.trim(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Code Q&A failed.");
      }

      setAskResult((await response.json()) as CodeAskResult);
    } catch (askError) {
      setError(
        askError instanceof Error ? askError.message : "Code Q&A failed.",
      );
    } finally {
      setIsAsking(false);
    }
  };

  const runAnalysis = async () => {
    if (!repo || !selectedFile) {
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch("/api/code/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoId: repo.repoId,
          file: selectedFile,
          mode,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Analysis failed.");
      }

      setAnalysis((await response.json()) as CodeAnalysisResult);
    } catch (analyzeError) {
      setError(
        analyzeError instanceof Error
          ? analyzeError.message
          : "Analysis failed.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!activeRepo || !repo) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        Add a repository in the <strong>Session library</strong> above, then
        return here to map files, find bugs, and ask code questions.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      {!embedded && (
        <div className="mb-3">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Code intelligence
          </h2>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Using {repo.name}: {repo.fileCount} files
          {activeRepo.indexed &&
            ` · indexed${
              activeRepo.indexedChunks
                ? ` (${activeRepo.indexedChunks} chunks)`
                : ""
            }`}
        </p>
        {!activeRepo.indexed && (
          <button
            type="button"
            onClick={() => void handleIndex()}
            disabled={isIndexing}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-white disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            {isIndexing ? "Indexing…" : "Index for Q&A"}
          </button>
        )}
      </div>

      {isMapping && (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Generating repository map…
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>
      )}

      <form
        onSubmit={(event) => void handleAsk(event)}
        className="mt-4 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"
      >
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Ask about the codebase
        </h3>
        {!activeRepo.indexed && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Index the repository first for better semantic answers.
          </p>
        )}
        <input
          type="text"
          value={repoQuestion}
          onChange={(event) => setRepoQuestion(event.target.value)}
          placeholder="How does authentication work in this repo?"
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={!repoQuestion.trim() || isAsking}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isAsking ? "Searching…" : "Ask"}
        </button>
      </form>

      {askResult && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Answer
            </h3>
            <span className="text-xs text-zinc-500">
              confidence: {askResult.confidence} · {askResult.retrieved_chunks}{" "}
              chunks
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            {askResult.answer}
          </p>
          {askResult.sources.length > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              Sources: {askResult.sources.join(", ")}
            </p>
          )}
          {askResult.limitations && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Limitations: {askResult.limitations}
            </p>
          )}
        </div>
      )}

      {repoMap && (
        <div className="mt-4 space-y-3">
          <div>
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Repository map — {repoMap.project_name}
            </h3>
            {repoMap.summary && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {repoMap.summary}
              </p>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {repoMap.components.map((component) => (
              <div
                key={component.name}
                className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {component.name}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {component.description}
                </p>
                <ul className="mt-2 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  {(component.files ?? []).map((file) => (
                    <li key={file}>{file}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div className="flex flex-wrap gap-2">
          {(["explain", "bugs", "improve"] as AnalyzeMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                mode === item
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              {MODE_LABELS[item]}
            </button>
          ))}
        </div>

        <select
          value={selectedFile}
          onChange={(event) => setSelectedFile(event.target.value)}
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          {repo.files.map((file) => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void runAnalysis()}
          disabled={!selectedFile || isAnalyzing}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isAnalyzing ? "Analyzing…" : `Run ${MODE_LABELS[mode]}`}
        </button>
      </div>

      {analysis && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {MODE_LABELS[analysis.mode]} — {analysis.file}
          </h3>
          {analysis.summary && (
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              {analysis.summary}
            </p>
          )}

          {analysis.key_elements && analysis.key_elements.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              {analysis.key_elements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          {analysis.data_flow && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-medium">Data flow:</span>{" "}
              {analysis.data_flow}
            </p>
          )}

          {analysis.issues && analysis.issues.length > 0 && (
            <ul className="mt-3 space-y-2">
              {analysis.issues.map((issue, index) => (
                <li
                  key={`${issue.line}-${index}`}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/30"
                >
                  <span className="font-medium">
                    Line {issue.line ?? "?"} ({issue.severity ?? "unknown"})
                  </span>
                  <p className="mt-1">{issue.description}</p>
                  {issue.suggestion && (
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      Fix: {issue.suggestion}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {analysis.suggestions && analysis.suggestions.length > 0 && (
            <ul className="mt-3 space-y-2">
              {analysis.suggestions.map((item, index) => (
                <li
                  key={`${item.title}-${index}`}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-900 dark:bg-blue-950/30"
                >
                  <span className="font-medium">{item.title}</span>
                  <p className="mt-1">{item.description}</p>
                  {item.impact && (
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      Impact: {item.impact}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
