"use client";

import { useState, type FormEvent } from "react";
import type { ActiveDocument, ResearchNotes } from "@/lib/types";

interface ResearchPanelProps {
  activeDocument: ActiveDocument | null;
  embedded?: boolean;
}

function NotesSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">No items returned.</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          {items.map((item) => (
            <li key={`${title}-${item}`}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ResearchPanel({
  activeDocument,
  embedded = false,
}: ResearchPanelProps) {
  const [question, setQuestion] = useState("");
  const [notes, setNotes] = useState<ResearchNotes | null>(null);
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

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          documentId: activeDocument?.documentId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Research agent failed.");
      }

      const result = (await response.json()) as ResearchNotes;
      setNotes(result);
    } catch (submitError) {
      setNotes(null);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Research agent failed.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      {!embedded && (
        <div className="mb-3">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Research notes
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Produces structured notes: concepts, evidence, limitations, and
            future work.
            {activeDocument
              ? ` Grounded in ${activeDocument.filename}.`
              : " Upload a document above to ground notes in your file."}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="e.g. Compare Vision Transformers and CNNs for medical image segmentation"
          rows={3}
          disabled={isLoading}
          className="w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={!question.trim() || isLoading}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isLoading ? "Running research…" : "Run research"}
        </button>
      </form>

      {error && (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>
      )}

      {notes && (
        <div className="mt-4 space-y-3">
          {notes.summary && (
            <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {notes.summary}
            </p>
          )}
          <p className="text-xs text-zinc-500">
            {notes.grounded_in_document
              ? "Notes grounded in uploaded document context."
              : "General research mode (no document context)."}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <NotesSection
              title="Important concepts"
              items={notes.important_concepts}
            />
            <NotesSection title="Evidence" items={notes.evidence} />
            <NotesSection title="Limitations" items={notes.limitations} />
            <NotesSection title="Future work" items={notes.future_work} />
          </div>
        </div>
      )}
    </section>
  );
}
