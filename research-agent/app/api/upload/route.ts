import { SUPPORTED_UPLOAD_EXTENSIONS } from "@/lib/config";
import { ingestDocumentUpload, isRagBackendAvailable } from "@/lib/rag-client";
import type { UploadResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function isSupportedUpload(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return SUPPORTED_UPLOAD_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

export async function POST(req: Request) {
  let formData: FormData;

  try {
    formData = await req.formData();
  } catch {
    return Response.json(
      { error: "Expected multipart form data.", code: "invalid_request" },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json(
      { error: 'Missing "file" field in form data.', code: "invalid_request" },
      { status: 400 },
    );
  }

  if (!isSupportedUpload(file)) {
    return Response.json(
      {
        error: "Supported types: PDF, Markdown (.md), and plain text (.txt).",
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  const response: UploadResponse = {
    filename: file.name,
    path: file.name,
    size: file.size,
    ingested: false,
  };

  if (!(await isRagBackendAvailable())) {
    response.ingestError =
      "RAG backend is not reachable. Check RAG_BACKEND_URL and that Render is awake.";
    return Response.json(response, { status: 503 });
  }

  try {
    // Forward bytes to the Python backend (Vercel filesystem is read-only).
    const ingested = await ingestDocumentUpload(file);
    response.documentId = ingested.document_id;
    response.chunkCount = ingested.chunk_count;
    response.filename = ingested.filename || file.name;
    response.ingested = true;
  } catch (error) {
    response.ingestError =
      error instanceof Error ? error.message : "Ingestion failed.";
    return Response.json(response, { status: 500 });
  }

  return Response.json(response);
}
