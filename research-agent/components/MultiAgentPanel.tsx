"use client";

import { useState, type FormEvent } from "react";
import { streamMultiAgentPipeline } from "@/lib/pipeline-stream";
import type { ActiveDocument, AgentTraceStep, PipelineResult } from "@/lib/types";

interface MultiAgentPanelProps {
  activeDocument: ActiveDocument | null;
  embedded?: boolean;
}

const AGENT_LABELS: Record<string, string> = {
  planner: "Planner",
  researcher: "Researcher",
  coder: "Coder",
  critic: "Critic",
  writer: "Writer",
};

const AGENT_ORDER = ["planner", "researcher", "coder", "critic", "writer"];

export function MultiAgentPanel({
  activeDocument,
  embedded = false,
}: MultiAgentPanelProps) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [liveTrace, setLiveTrace] = useState<AgentTraceStep[]>([]);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = question.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setLiveTrace([]);
    setCurrentAgent(AGENT_ORDER[0]);

    try {
      const payload = await streamMultiAgentPipeline(
        trimmed,
        activeDocument?.documentId,
        (step) => {
          setLiveTrace((previous) => [...previous, step]);
          const currentIndex = AGENT_ORDER.indexOf(step.agent);
          const nextAgent =
            currentIndex >= 0 && currentIndex < AGENT_ORDER.length - 1
              ? AGENT_ORDER[currentIndex + 1]
              : null;
          setCurrentAgent(nextAgent);
        },
      );
      setResult(payload);
      setCurrentAgent(null);
    } catch (submitError) {
      setResult(null);
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Multi-agent pipeline failed.";

      if (message.toLowerCase().includes("failed to fetch")) {
        setError(
          "Connection lost. Ensure the Python backend is running on port 8000 and Ollama is available. Each agent can take 1–2 minutes on CPU.",
        );
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
      setCurrentAgent(null);
    }
  };

  const traceToShow = result?.trace ?? liveTrace;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      {!embedded && (
        <div className="mb-3">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Multi-agent report
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Planner → Researcher → Coder → Critic → Writer.
            {activeDocument
              ? ` Grounded in ${activeDocument.filename}.`
              : " Upload a document above to ground the pipeline."}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="e.g. Analyze YOLO vs DETR"
          rows={3}
          disabled={isLoading}
          className="w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={!question.trim() || isLoading}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isLoading ? "Running agents…" : "Run multi-agent pipeline"}
        </button>
      </form>

      {isLoading && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {currentAgent
              ? `Running ${AGENT_LABELS[currentAgent] ?? currentAgent}… (5 agents, ~2–8 min on CPU)`
              : "Starting pipeline…"}
          </p>
          {traceToShow.length > 0 && (
            <ol className="space-y-2">
              {traceToShow.map((step) => (
                <li
                  key={`${step.agent}-${step.duration_ms}`}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-emerald-900 dark:text-emerald-200">
                      ✓ {AGENT_LABELS[step.agent] ?? step.agent}
                    </span>
                    <span className="text-xs text-emerald-700 dark:text-emerald-400">
                      {(step.duration_ms / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <p className="mt-1 text-emerald-800 dark:text-emerald-300">
                    {step.summary}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>
      )}

      {result && (
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Agent trace
            </h3>
            <ol className="mt-2 space-y-2">
              {result.trace.map((step) => (
                <li
                  key={`${step.agent}-${step.duration_ms}`}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {AGENT_LABELS[step.agent] ?? step.agent}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {(step.duration_ms / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                    {step.summary}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {result.tasks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Plan
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                {result.tasks.map((task) => (
                  <li key={task}>{task}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {result.final_report.title ?? "Final report"}
            </h3>
            {result.final_report.summary && (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {result.final_report.summary}
              </p>
            )}
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-zinc-800 dark:text-zinc-200">
              {result.final_report.report}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
