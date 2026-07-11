import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SUPPORTED_UPLOAD_EXTENSIONS, UPLOAD_DIR } from "@/lib/config";
import { ingestDocument, isRagBackendAvailable } from "@/lib/rag-client";
import type { UploadResponse } from "@/lib/types";

export const runtime = "nodejs";

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

  const uploadDir = path.join(process.cwd(), UPLOAD_DIR);
  await mkdir(uploadDir, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  const filePath = path.join(uploadDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(filePath, buffer);

  const response: UploadResponse = {
    filename: file.name,
    path: path.posix.join(UPLOAD_DIR, filename),
    size: buffer.byteLength,
    ingested: false,
  };

  if (await isRagBackendAvailable()) {
    try {
      const ingested = await ingestDocument(filePath);
      response.documentId = ingested.document_id;
      response.chunkCount = ingested.chunk_count;
      response.ingested = true;
    } catch (error) {
      response.ingestError =
        error instanceof Error ? error.message : "Ingestion failed.";
    }
  } else {
    response.ingestError =
      "RAG backend is not running. Start it with `uvicorn main:app --port 8000` in backend/.";
  }

  return Response.json(response);
}
