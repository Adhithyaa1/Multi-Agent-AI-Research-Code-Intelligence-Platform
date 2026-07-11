"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { getMessageText } from "@/lib/messages";
import type { ActiveDocument } from "@/lib/types";

function getErrorMessage(error: Error | undefined): string | null {
  if (!error) {
    return null;
  }

  const message = error.message.toLowerCase();

  if (message.includes("rag") || message.includes("8000")) {
    return "RAG backend is not running. Start it with `uvicorn main:app --port 8000` in backend/.";
  }

  if (message.includes("503") || message.includes("ollama")) {
    return "Ollama is not available. Install it from ollama.com/download, reopen PowerShell, then run `ollama pull llama3.1`.";
  }

  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Network error. Check that the dev server is running.";
  }

  return error.message || "Something went wrong. Please try again.";
}

interface ChatProps {
  activeDocument: ActiveDocument | null;
  embedded?: boolean;
}

export function Chat({ activeDocument, embedded = false }: ChatProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: activeDocument
          ? { documentId: activeDocument.documentId }
          : undefined,
      }),
    [activeDocument],
  );

  const { messages, sendMessage, status, error, stop } = useChat({ transport });

  const isBusy = status === "submitted" || status === "streaming";
  const errorMessage = getErrorMessage(error);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = input.trim();
    if (!trimmed || isBusy) {
      return;
    }

    sendMessage({ text: trimmed });
    setInput("");
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {!embedded && (
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          {activeDocument ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Answering about:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {activeDocument.filename}
              </span>
              <span className="ml-2 text-xs text-zinc-500">
                ({activeDocument.chunkCount} chunks)
              </span>
            </p>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              General chat — upload a document above for document Q&A
            </p>
          )}
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
            <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              {activeDocument ? "Ask about your document" : "Local research assistant"}
            </p>
            <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              {activeDocument
                ? "Questions will use retrieved sections from your uploaded file."
                : "Ask a question to start chatting. Responses stream from Ollama on your machine."}
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const text = getMessageText(message);
            const isUser = message.role === "user";

            return (
              <div
                key={message.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${
                    isUser
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  {text || (isBusy && !isUser ? "Thinking…" : "")}
                  {!isUser && isBusy && message.id === messages.at(-1)?.id && (
                    <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {errorMessage && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="border-t border-zinc-200 p-4 dark:border-zinc-800"
      >
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={
              activeDocument
                ? `Ask about ${activeDocument.filename}…`
                : "Type a message…"
            }
            rows={1}
            disabled={isBusy}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          {isBusy ? (
            <button
              type="button"
              onClick={stop}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Send
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
