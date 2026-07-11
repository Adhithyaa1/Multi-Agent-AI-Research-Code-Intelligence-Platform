"use client";

import { useRef, useState, type FormEvent } from "react";
import type {
  ActiveDocument,
  ActiveRepo,
  CodeRepoInfo,
  UploadResponse,
} from "@/lib/types";

const ACCEPTED_TYPES = ".pdf,.md,.txt,application/pdf,text/plain,text/markdown";

function isSupportedFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return (
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".txt")
  );
}

function toActiveRepo(
  loaded: CodeRepoInfo,
  indexedChunks: number | null = null,
): ActiveRepo {
  return {
    repoId: loaded.repoId,
    name: loaded.name,
    fileCount: loaded.fileCount,
    files: loaded.files,
    indexed: indexedChunks !== null && indexedChunks > 0,
    indexedChunks,
  };
}

interface SessionLibraryProps {
  activeDocument: ActiveDocument | null;
  activeRepo: ActiveRepo | null;
  onDocumentChange: (document: ActiveDocument | null) => void;
  onRepoChange: (repo: ActiveRepo | null) => void;
}

export function SessionLibrary({
  activeDocument,
  activeRepo,
  onDocumentChange,
  onRepoChange,
}: SessionLibraryProps) {
  const docInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [docError, setDocError] = useState<string | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isImportingRepo, setIsImportingRepo] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);

  const uploadDocument = async (file: File) => {
    if (!isSupportedFile(file)) {
      setDocError("Supported types: PDF, Markdown (.md), and plain text (.txt).");
      return;
    }

    setIsUploadingDoc(true);
    setDocError(null);

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
      if (!result.ingested || !result.documentId || result.chunkCount === undefined) {
        throw new Error(result.ingestError ?? "Document indexing failed.");
      }

      onDocumentChange({
        documentId: result.documentId,
        filename: result.filename,
        chunkCount: result.chunkCount,
      });
    } catch (error) {
      setDocError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploadingDoc(false);
      if (docInputRef.current) {
        docInputRef.current.value = "";
      }
    }
  };

  const importGithub = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = githubUrl.trim();
    if (!url || isImportingRepo) {
      return;
    }

    setIsImportingRepo(true);
    setRepoError(null);

    try {
      const response = await fetch("/api/code/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "GitHub import failed.");
      }

      const loaded = (await response.json()) as CodeRepoInfo;
      onRepoChange(toActiveRepo(loaded, null));
      setGithubUrl("");
    } catch (error) {
      setRepoError(
        error instanceof Error ? error.message : "GitHub import failed.",
      );
    } finally {
      setIsImportingRepo(false);
    }
  };

  const uploadFolder = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    setIsImportingRepo(true);
    setRepoError(null);

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/code/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Folder upload failed.");
      }

      const loaded = (await response.json()) as CodeRepoInfo;
      onRepoChange(toActiveRepo(loaded, null));
    } catch (error) {
      setRepoError(
        error instanceof Error ? error.message : "Folder upload failed.",
      );
    } finally {
      setIsImportingRepo(false);
      if (folderInputRef.current) {
        folderInputRef.current.value = "";
      }
    }
  };

  const indexRepo = async () => {
    if (!activeRepo || isIndexing) {
      return;
    }

    setIsIndexing(true);
    setRepoError(null);

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
      onRepoChange({
        ...activeRepo,
        indexed: true,
        indexedChunks: result.indexed_chunks,
      });
    } catch (error) {
      setRepoError(error instanceof Error ? error.message : "Indexing failed.");
    } finally {
      setIsIndexing(false);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Session library
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Keep one document and one repository for every tool. Add or remove
          them anytime — they stay available while you switch modes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Document (1)
            </h3>
            {activeDocument && (
              <button
                type="button"
                onClick={() => onDocumentChange(null)}
                className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
              >
                Remove
              </button>
            )}
          </div>

          {activeDocument ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="font-medium text-emerald-900 dark:text-emerald-200">
                {activeDocument.filename}
              </p>
              <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                {activeDocument.chunkCount} chunks indexed
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              disabled={isUploadingDoc}
              className="w-full rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-4 text-sm text-zinc-600 transition hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
            >
              {isUploadingDoc ? "Uploading…" : "Upload PDF / .md / .txt"}
            </button>
          )}

          <input
            ref={docInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void uploadDocument(file);
              }
            }}
          />

          {docError && (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">{docError}</p>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Repository (1)
            </h3>
            {activeRepo && (
              <button
                type="button"
                onClick={() => onRepoChange(null)}
                className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
              >
                Remove
              </button>
            )}
          </div>

          {activeRepo ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
                <p className="font-medium text-emerald-900 dark:text-emerald-200">
                  {activeRepo.name}
                </p>
                <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                  {activeRepo.fileCount} files
                  {activeRepo.indexed
                    ? ` · indexed${
                        activeRepo.indexedChunks
                          ? ` (${activeRepo.indexedChunks} chunks)`
                          : ""
                      }`
                    : " · not indexed yet"}
                </p>
              </div>
              {!activeRepo.indexed && (
                <button
                  type="button"
                  onClick={() => void indexRepo()}
                  disabled={isIndexing}
                  className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {isIndexing ? "Indexing…" : "Index for Q&A"}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <form onSubmit={(event) => void importGithub(event)} className="flex gap-2">
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(event) => setGithubUrl(event.target.value)}
                  placeholder="owner/repo or github.com/…"
                  disabled={isImportingRepo}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={!githubUrl.trim() || isImportingRepo}
                  className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {isImportingRepo ? "…" : "Import"}
                </button>
              </form>
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                disabled={isImportingRepo}
                className="w-full rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-600 transition hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
              >
                Or upload a project folder
              </button>
              <input
                ref={folderInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => void uploadFolder(event.target.files)}
                {...({ webkitdirectory: "", directory: "" } as Record<
                  string,
                  string
                >)}
              />
            </div>
          )}

          {repoError && (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">{repoError}</p>
          )}
        </div>
      </div>
    </section>
  );
}
