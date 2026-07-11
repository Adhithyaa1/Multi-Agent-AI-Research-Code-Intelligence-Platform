"use client";

import { useEffect, useState } from "react";
import { AgentChatPanel } from "@/components/AgentChatPanel";
import { Chat } from "@/components/Chat";
import { CodeIntelligencePanel } from "@/components/CodeIntelligencePanel";
import { EvaluationDashboard } from "@/components/EvaluationDashboard";
import { ModeHub } from "@/components/ModeHub";
import { MultiAgentPanel } from "@/components/MultiAgentPanel";
import { ResearchPanel } from "@/components/ResearchPanel";
import { SessionLibrary } from "@/components/SessionLibrary";
import { getModeDefinition, type AppMode, type AppTab } from "@/lib/modes";
import type { ActiveDocument, ActiveRepo } from "@/lib/types";

const SESSION_STORAGE_KEY = "research-agent-session-v1";

interface PersistedSession {
  document: ActiveDocument | null;
  repo: ActiveRepo | null;
}

function loadSession(): PersistedSession {
  if (typeof window === "undefined") {
    return { document: null, repo: null };
  }

  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return { document: null, repo: null };
    }
    const parsed = JSON.parse(raw) as PersistedSession;
    return {
      document: parsed.document ?? null,
      repo: parsed.repo
        ? {
            ...parsed.repo,
            files: parsed.repo.files ?? [],
          }
        : null,
    };
  } catch {
    return { document: null, repo: null };
  }
}

export function HomeClient() {
  const [tab, setTab] = useState<AppTab>("workspace");
  const [mode, setMode] = useState<AppMode | null>(null);
  const [activeDocument, setActiveDocument] = useState<ActiveDocument | null>(
    null,
  );
  const [activeRepo, setActiveRepo] = useState<ActiveRepo | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadSession();
    setActiveDocument(saved.document);
    setActiveRepo(saved.repo);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ document: activeDocument, repo: activeRepo }),
    );
  }, [activeDocument, activeRepo, hydrated]);

  const modeDef = mode ? getModeDefinition(mode) : null;

  if (!hydrated) {
    return (
      <div className="flex min-h-full flex-col bg-zinc-50 dark:bg-black">
        <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto w-full max-w-4xl">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Research Agent
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              AI research & code intelligence
            </p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            Loading workspace…
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Research Agent
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              AI research & code intelligence
            </p>
          </div>

          <nav className="flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setTab("workspace")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                tab === "workspace"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Workspace
            </button>
            <button
              type="button"
              onClick={() => setTab("metrics")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                tab === "metrics"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Metrics
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 sm:p-6">
        {tab === "metrics" ? (
          <EvaluationDashboard />
        ) : (
          <>
            <SessionLibrary
              activeDocument={activeDocument}
              activeRepo={activeRepo}
              onDocumentChange={setActiveDocument}
              onRepoChange={setActiveRepo}
            />

            {mode === null ? (
              <ModeHub onSelect={setMode} />
            ) : (
              <div className="flex flex-1 flex-col gap-4">
                <div>
                  <button
                    type="button"
                    onClick={() => setMode(null)}
                    className="mb-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-200"
                  >
                    ← All tools
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden>
                      {modeDef?.icon}
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {modeDef?.title}
                      </h2>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {modeDef?.detail}
                      </p>
                    </div>
                  </div>
                </div>

                {mode === "chat" && (
                  <Chat activeDocument={activeDocument} embedded />
                )}

                {mode === "research" && (
                  <ResearchPanel activeDocument={activeDocument} embedded />
                )}

                {mode === "code" && (
                  <CodeIntelligencePanel
                    activeRepo={activeRepo}
                    onRepoChange={setActiveRepo}
                    embedded
                  />
                )}

                {mode === "pipeline" && (
                  <MultiAgentPanel activeDocument={activeDocument} embedded />
                )}

                {mode === "agent" && (
                  <AgentChatPanel
                    activeDocument={activeDocument}
                    activeRepo={activeRepo}
                    embedded
                  />
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
