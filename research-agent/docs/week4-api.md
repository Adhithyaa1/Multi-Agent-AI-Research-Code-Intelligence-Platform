# Week 4 API Contract

Phase 4 adds a LangGraph multi-agent pipeline:

`planner → researcher → coder → critic → writer`

## Architecture

```
Browser
  → POST /api/pipeline
      → Python POST /pipeline
          → (optional) retrieve document chunks
          → agents/graph.py (LangGraph)
          → Ollama (llama3.1)
```

## Python backend

### `POST /pipeline`

**Request**

```json
{
  "question": "Analyze YOLO vs DETR",
  "document_id": "optional-uuid",
  "top_k": 6
}
```

**Response**

```json
{
  "question": "Analyze YOLO vs DETR",
  "document_id": null,
  "grounded_in_document": false,
  "tasks": ["Find YOLO architecture", "Find DETR architecture", "Compare performance"],
  "plan_summary": "...",
  "research_notes": { "...": "..." },
  "code_analysis": { "...": "..." },
  "critique": { "...": "..." },
  "final_report": {
    "title": "...",
    "report": "# ... markdown ...",
    "summary": "..."
  },
  "trace": [
    {
      "agent": "planner",
      "status": "ok",
      "summary": "Planned 3 tasks",
      "duration_ms": 2300
    }
  ]
}
```

**Errors**

| Status | When |
|--------|------|
| 400 | Empty question |
| 503 | Ollama unavailable |
| 500 | Pipeline or retrieval failure |

## Next.js

### `POST /api/pipeline`

**Request**

```json
{
  "question": "Analyze YOLO vs DETR",
  "documentId": "optional-uuid"
}
```

**Response:** same shape as Python `/pipeline`.

## CLI smoke test

```bash
python -m agents.graph "Analyze YOLO vs DETR"
```

## Curl smoke test

```bash
curl -X POST http://localhost:8000/pipeline \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"Analyze YOLO vs DETR\"}"
```

Note: a full pipeline run makes several Ollama calls and can take 1–3 minutes on CPU.
