"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  formatToolName,
  getMessageText,
  getToolInvocations,
} from "@/lib/messages";
import type { ActiveDocument, ActiveRepo } from "@/lib/types";

function getErrorMessage(error: Error | undefined): string | null {
  if (!error) {
    return null;
  }

  const message = error.message.toLowerCase();

  if (message.includes("rag") || message.includes("8000")) {
    return "RAG backend is not running. Start it with `uvicorn main:app --port 8000` in backend/.";
  }

  if (message.includes("503") || message.includes("ollama")) {
    return "Ollama is not available. Install it from ollama.com/download, then run `ollama pull llama3.1`.";
  }

  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Network error. Check that the dev server and backend are running.";
  }

  return error.message || "Something went wrong. Please try again.";
}

interface AgentChatPanelProps {
  activeDocument: ActiveDocument | null;
  activeRepo: ActiveRepo | null;
  embedded?: boolean;
}

export function AgentChatPanel({
  activeDocument,
  activeRepo,
  embedded = false,
}: AgentChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        body: {
          ...(activeDocument
            ? { documentId: activeDocument.documentId }
            : {}),
          ...(activeRepo ? { repoId: activeRepo.repoId } : {}),
        },
      }),
    [activeDocument, activeRepo],
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
    <section className="flex min-h-[420px] flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {!embedded && (
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Smart assistant
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Automatically searches documents and code before answering.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span
              className={`rounded-full px-2 py-0.5 ${
                activeDocument
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900"
              }`}
            >
              Document: {activeDocument?.filename ?? "none"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 ${
                activeRepo
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900"
              }`}
            >
              Repo: {activeRepo?.name ?? "none"}
              {activeRepo?.indexed ? " (indexed)" : activeRepo ? " (not indexed)" : ""}
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
            <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Agent with tools
            </p>
            <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              Ask a research or code question. The agent will call search and
              research tools using your session document and repository.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const text = getMessageText(message);
            const tools = getToolInvocations(message);
            const isUser = message.role === "user";

            return (
              <div
                key={message.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] space-y-2 rounded-2xl px-4 py-3 text-sm leading-6 ${
                    isUser
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  {tools.map((part) => {
                    const toolName =
                      part.type === "dynamic-tool"
                        ? part.toolName
                        : part.type.replace(/^tool-/, "");
                    const state = "state" in part ? part.state : "unknown";

                    return (
                      <div
                        key={part.toolCallId}
                        className="rounded-lg border border-zinc-300/60 bg-white/80 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950/80"
                      >
                        <p className="font-medium text-zinc-800 dark:text-zinc-200">
                          {formatToolName(toolName)}{" "}
                          <span className="font-normal text-zinc-500">
                            ({state})
                          </span>
                        </p>
                        {"input" in part && part.input !== undefined && (
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                            {JSON.stringify(part.input, null, 2)}
                          </pre>
                        )}
                        {"output" in part && part.output !== undefined && (
                          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-emerald-700 dark:text-emerald-300">
                            {typeof part.output === "string"
                              ? part.output
                              : JSON.stringify(part.output, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                  {text && (
                    <p className="whitespace-pre-wrap">
                      {text}
                      {!isUser &&
                        isBusy &&
                        message.id === messages.at(-1)?.id && (
                          <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />
                        )}
                    </p>
                  )}
                  {!text &&
                    !isUser &&
                    isBusy &&
                    message.id === messages.at(-1)?.id && (
                      <p>Thinking…</p>
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
            placeholder="Ask the agent to search documents or code…"
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
