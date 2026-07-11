"use client";

import { APP_MODES, type AppMode } from "@/lib/modes";

interface ModeHubProps {
  onSelect: (mode: AppMode) => void;
}

export function ModeHub({ onSelect }: ModeHubProps) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          What would you like to do?
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-500 dark:text-zinc-400">
          Load a document and/or repository in the session library above, then
          choose a workflow. Your context stays available across tools.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {APP_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => onSelect(mode.id)}
            className="group rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            <span className="text-2xl" aria-hidden>
              {mode.icon}
            </span>
            <h3 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {mode.title}
            </h3>
            <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">
              {mode.description}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {mode.detail}
            </p>
            <span className="mt-4 inline-block text-xs font-medium text-zinc-900 opacity-0 transition group-hover:opacity-100 dark:text-zinc-100">
              Open →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
