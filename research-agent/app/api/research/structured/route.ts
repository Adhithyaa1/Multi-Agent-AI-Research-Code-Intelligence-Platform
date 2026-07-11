import { generateObject } from "ai";
import { z } from "zod";
import { OLLAMA_MODEL } from "@/lib/config";
import { isOllamaAvailable } from "@/lib/ollama-health";
import { ollama } from "@/lib/ollama";
import {
  buildRagSystemPrompt,
  isRagBackendAvailable,
  retrieveContext,
} from "@/lib/rag-client";

const researchSchema = z.object({
  question: z.string(),
  important_concepts: z.array(z.string()),
  evidence: z.array(z.string()),
  limitations: z.array(z.string()),
  future_work: z.array(z.string()),
  summary: z.string(),
});

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: { question?: string; documentId?: string };

  try {
    body = (await req.json()) as { question?: string; documentId?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return Response.json({ error: "question is required." }, { status: 400 });
  }

  if (!(await isOllamaAvailable())) {
    return Response.json({ error: "Ollama is not available." }, { status: 503 });
  }

  let system = `You are a research assistant. Produce structured research notes for the user's question.

Rules:
- important_concepts: 3–6 key ideas
- evidence: concrete supporting points
- limitations: gaps or caveats
- future_work: 2–4 follow-up directions
- summary: 2–3 sentence overview`;

  if (body.documentId) {
    if (!(await isRagBackendAvailable())) {
      return Response.json(
        { error: "RAG backend is not available." },
        { status: 503 },
      );
    }

    try {
      const chunks = await retrieveContext(body.documentId, question);
      system = buildRagSystemPrompt(chunks);
    } catch {
      return Response.json(
        { error: "Failed to retrieve document context." },
        { status: 500 },
      );
    }
  }

  try {
    const { object } = await generateObject({
      model: ollama(OLLAMA_MODEL),
      schema: researchSchema,
      system,
      prompt: question,
      maxRetries: 0,
    });

    return Response.json({
      ...object,
      grounded_in_document: Boolean(body.documentId),
      document_id: body.documentId ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Structured research failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
