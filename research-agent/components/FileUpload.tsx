"use client";

import { useRef, useState, type DragEvent } from "react";
import type { ActiveDocument, UploadResponse } from "@/lib/types";

type UploadState =
  | { status: "idle" }
  | { status: "selected"; file: File }
  | { status: "uploading"; file: File }
  | { status: "uploaded"; file: File; result: UploadResponse }
  | { status: "error"; file: File | null; message: string };

const ACCEPTED_TYPES = ".pdf,.md,.txt,application/pdf,text/plain,text/markdown";

function isSupportedFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return (
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".txt")
  );
}

interface FileUploadProps {
  onDocumentReady: (document: ActiveDocument | null) => void;
}

export function FileUpload({ onDocumentReady }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });

  const uploadFile = async (file: File) => {
    if (!isSupportedFile(file)) {
      setState({
        status: "error",
        file,
        message: "Supported types: PDF, Markdown (.md), and plain text (.txt).",
      });
      onDocumentReady(null);
      return;
    }

    setState({ status: "uploading", file });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Upload failed.");
      }

      const result = (await response.json()) as UploadResponse;
      setState({ status: "uploaded", file, result });

      if (result.ingested && result.documentId && result.chunkCount !== undefined) {
        onDocumentReady({
          documentId: result.documentId,
          filename: result.filename,
          chunkCount: result.chunkCount,
        });
      } else {
        onDocumentReady(null);
      }
    } catch (error) {
      onDocumentReady(null);
      setState({
        status: "error",
        file,
        message:
          error instanceof Error ? error.message : "Upload failed unexpectedly.",
      });
    }
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }

    setState({ status: "selected", file });
    void uploadFile(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  };

  return (
    <section className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
      <div className="mb-3">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Document upload
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Upload a PDF, Markdown, or text file. It will be chunked and embedded
          for Q&A.
        </p>
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-xl border border-zinc-200 bg-white px-4 py-6 text-center transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
      >
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Drag and drop a document here, or click to browse
        </p>
        <p className="mt-1 text-xs text-zinc-500">PDF, .md, or .txt</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      {state.status === "selected" && (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Selected: {state.file.name}
        </p>
      )}

      {state.status === "uploading" && (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Uploading and indexing {state.file.name}…
        </p>
      )}

      {state.status === "uploaded" && (
        <div className="mt-3 space-y-1 text-sm">
          {state.result.ingested ? (
            <p className="text-emerald-700 dark:text-emerald-300">
              Ready for Q&A: {state.result.filename} ({state.result.chunkCount}{" "}
              chunks indexed)
            </p>
          ) : (
            <p className="text-amber-700 dark:text-amber-300">
              Saved {state.result.filename}, but indexing failed:{" "}
              {state.result.ingestError ?? "unknown error"}
            </p>
          )}
        </div>
      )}

      {state.status === "error" && (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      )}
    </section>
  );
}
