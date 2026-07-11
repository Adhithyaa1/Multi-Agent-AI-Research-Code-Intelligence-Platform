# Week 7 API — Tool-calling agent

## Agent chat (streaming + tools)

`POST /api/agent`

```json
{
  "messages": [/* UIMessage[] from useChat */],
  "documentId": "optional-uuid",
  "repoId": "optional-uuid"
}
```

Returns a UI message stream. The model may call:

| Tool | When | Backend |
|------|------|---------|
| `searchDocuments` | Document uploaded | `POST /retrieve` |
| `searchCodeRepo` | Repo indexed | `POST /code/retrieve` |
| `getResearchNotes` | Research questions | `POST /research` |

Uses `stopWhen: stepCountIs(5)` for up to 5 tool loops.

Requires Ollama with tool-calling support (`llama3.1`).

---

## Structured research (generateObject)

`POST /api/research/structured`

```json
{
  "question": "Compare ViT and CNN for segmentation",
  "documentId": "optional-uuid"
}
```

Returns Zod-validated JSON:

```json
{
  "question": "...",
  "important_concepts": [],
  "evidence": [],
  "limitations": [],
  "future_work": [],
  "summary": "...",
  "grounded_in_document": true,
  "document_id": "..."
}
```

---

## Code retrieve (new backend endpoint)

`POST /code/retrieve`

```json
{
  "repo_id": "uuid",
  "query": "authentication middleware",
  "top_k": 5
}
```

Returns semantic code chunks without generating an answer (used by agent tools).
