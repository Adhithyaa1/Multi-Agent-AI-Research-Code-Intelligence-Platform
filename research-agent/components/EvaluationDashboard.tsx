"use client";

import { useCallback, useEffect, useState } from "react";
import type { EvalMetrics } from "@/lib/types";

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function EvaluationDashboard() {
  const [metrics, setMetrics] = useState<EvalMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/eval/metrics");
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Failed to load metrics.");
      }
      setMetrics((await response.json()) as EvalMetrics);
    } catch (loadError) {
      setMetrics(null);
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load metrics.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Usage metrics
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Internal timing and run statistics for operators.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadMetrics()}
          disabled={isLoading}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-white disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-950"
        >
          Refresh
        </button>
      </div>

      {isLoading && !metrics && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading metrics…</p>
      )}

      {error && (
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      )}

      {metrics && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs text-zinc-500">Total runs</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {metrics.total_runs}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs text-zinc-500">Avg duration</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {formatDuration(metrics.avg_duration_ms)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs text-zinc-500">Critic confidence (avg)</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {metrics.critic_confidence_avg ?? "—"}
              </p>
            </div>
          </div>

          {Object.keys(metrics.by_type).length > 0 && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                By run type
              </h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {Object.entries(metrics.by_type).map(([type, stats]) => (
                  <div
                    key={type}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {type}
                    </span>
                    <span className="text-zinc-500">
                      {" "}
                      — {stats.count} runs, avg {formatDuration(stats.avg_duration_ms)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metrics.recent_runs.length > 0 ? (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Recent runs
              </h3>
              <ul className="mt-2 space-y-2">
                {metrics.recent_runs.map((run) => (
                  <li
                    key={run.id}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {run.type}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {formatDuration(run.duration_ms)} · {formatTimestamp(run.timestamp)}
                      </span>
                    </div>
                    {Object.keys(run.metadata).length > 0 && (
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {JSON.stringify(run.metadata)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              No runs logged yet. Run the multi-agent pipeline or code analysis to
              populate metrics.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
