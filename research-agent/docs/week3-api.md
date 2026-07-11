# Week 3 API Contract

Phase 3 adds the first agent: a research assistant that turns a question into structured research notes.

## Architecture

```
Browser
  → POST /api/research
      → Python POST /research
          → (optional) retrieve document chunks
          → agents/research_agent.py
          → Ollama (llama3.1)
```

## Python backend

### `POST /research`

**Request**

```json
{
  "question": "Compare Vision Transformers and CNNs for medical imaging",
  "document_id": "optional-uuid",
  "top_k": 6
}
```

**Response**

```json
{
  "question": "Compare Vision Transformers and CNNs for medical imaging",
  "important_concepts": ["...", "..."],
  "evidence": ["...", "..."],
  "limitations": ["...", "..."],
  "future_work": ["...", "..."],
  "summary": "One short paragraph overview.",
  "grounded_in_document": true,
  "document_id": "optional-uuid"
}
```

When `document_id` is set, the backend retrieves relevant chunks first and grounds the notes in that context.

**Errors**

| Status | When |
|--------|------|
| 400 | Empty question |
| 503 | Ollama unavailable |
| 500 | Agent or retrieval failure |

## Next.js

### `POST /api/research`

**Request**

```json
{
  "question": "Compare Vision Transformers and CNNs for medical imaging",
  "documentId": "optional-uuid"
}
```

**Response:** same shape as Python `/research`.

**Errors**

| Status | Code | When |
|--------|------|------|
| 400 | `invalid_request` | Missing/invalid question |
| 503 | `rag_unavailable` | Python backend down |
| 503 | `ollama_unavailable` | Ollama down |
| 500 | `server_error` | Unexpected failure |

## CLI smoke test

From the repo root (with backend venv activated so dependencies are available, or system Python):

```bash
python -m agents.research_agent "Compare Vision Transformers and CNNs for medical imaging"
```

## Curl smoke test

```bash
curl -X POST http://localhost:8000/research \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"Compare Vision Transformers and CNNs for medical imaging\"}"
```
