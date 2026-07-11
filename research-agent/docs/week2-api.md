# Week 2 API Contract

Phase 2 adds RAG (Retrieval-Augmented Generation). The Python backend handles ingestion and retrieval; Next.js orchestrates upload, chat, and Ollama streaming.

## Architecture

```
Browser
  → POST /api/upload     → save file → Python POST /ingest
  → POST /api/chat       → Python POST /retrieve (if documentId) → Ollama stream
Python backend (localhost:8000)
  → ChromaDB + sentence-transformers
Ollama (localhost:11434)
  → llama3.1
```

## Python backend (`http://localhost:8000`)

### `GET /health`

```json
{ "status": "ok" }
```

### `POST /ingest`

**Request**

```json
{
  "file_path": "C:/absolute/path/to/uploads/123-paper.pdf",
  "document_id": "optional-uuid"
}
```

**Response**

```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "paper.pdf",
  "chunk_count": 42
}
```

Supported types: `.pdf`, `.md`, `.txt`

### `POST /retrieve`

**Request**

```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "query": "What is the main contribution?",
  "top_k": 4
}
```

**Response**

```json
{
  "chunks": [
    {
      "text": "The paper introduces...",
      "score": 0.82,
      "metadata": {
        "document_id": "...",
        "filename": "paper.pdf",
        "chunk_index": 3,
        "source": "paper.pdf"
      }
    }
  ]
}
```

## Next.js routes

### `POST /api/upload` (updated)

Same multipart upload as Week 1, plus ingestion.

**Response (success)**

```json
{
  "filename": "paper.pdf",
  "path": "uploads/1710000000000-paper.pdf",
  "size": 123456,
  "documentId": "550e8400-e29b-41d4-a716-446655440000",
  "chunkCount": 42,
  "ingested": true
}
```

If the RAG backend is down, upload still saves the file but returns `ingested: false`.

### `POST /api/chat` (updated)

Accepts the AI SDK UI message shape plus optional:

```json
{
  "messages": [ "... UIMessage array ..." ],
  "documentId": "550e8400-e29b-41d4-a716-446655440000"
}
```

When `documentId` is set:

1. Extract the latest user message as the retrieval query
2. Call Python `/retrieve`
3. Inject retrieved chunks into a system prompt
4. Stream Ollama reply

When `documentId` is omitted, behavior matches Week 1 (plain chat).

**Errors**

| Status | Code | When |
|--------|------|------|
| 503 | `rag_unavailable` | Python backend not running (RAG mode only) |
| 503 | `ollama_unavailable` | Ollama not running |
| 400 | `invalid_request` | Bad request body |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `RAG_BACKEND_URL` | `http://localhost:8000` | Python FastAPI base URL |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API |
| `OLLAMA_MODEL` | `llama3.1` | Chat model |

## Smoke tests

```bash
# Terminal 1
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2
cd research-agent && npm run dev

# Health
curl http://localhost:8000/health

# Ingest (use your absolute path)
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d "{\"file_path\": \"C:/path/to/file.pdf\"}"
```
