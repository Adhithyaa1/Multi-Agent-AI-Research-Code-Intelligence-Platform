# Week 1 API Contract

This document locks the frontend/backend contract for Phase 1 (streaming chat).

## Chat

### `POST /api/chat`

Streams an assistant reply from local Ollama.

**Request body**

```json
{
  "messages": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi there." }
  ]
}
```

When using the Vercel AI SDK client (`useChat` + `DefaultChatTransport`), messages are sent as UI messages with `parts` instead of plain `content`. The route accepts the AI SDK shape and converts it server-side.

**Response**

- Success: `text/event-stream` (AI SDK UI message stream)
- Tokens arrive incrementally; the client renders them as they stream in

**Errors**

| Status | Code | When |
|--------|------|------|
| 400 | `invalid_request` | Missing/invalid JSON or messages |
| 503 | `ollama_unavailable` | Ollama is not running or unreachable |
| 500 | `server_error` | Unexpected server failure |

Example error body:

```json
{
  "error": "Ollama is not running. Start it with `ollama serve`...",
  "code": "ollama_unavailable"
}
```

## Upload (stretch)

### `POST /api/upload`

Accepts a single PDF via `multipart/form-data`.

**Form field**

- `file` — PDF only (`application/pdf`)

**Response**

```json
{
  "filename": "paper.pdf",
  "path": "uploads/1710000000000-paper.pdf",
  "size": 123456
}
```

No embeddings or Q&A yet — storage only until Week 2 RAG.

## Local configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama HTTP API |
| `OLLAMA_MODEL` | `llama3.1` | Model name passed to Ollama |
| `UPLOAD_DIR` | `uploads` | Server-side PDF storage folder |

## Smoke tests

```bash
# Ollama health
curl http://localhost:11434/api/tags

# Chat route (from another terminal while npm run dev is running)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}"
```
