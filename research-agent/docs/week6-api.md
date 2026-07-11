# Week 6 API — GitHub import, code indexing, Q&A, evaluation

Backend base URL: `http://localhost:8000` (or `RAG_BACKEND_URL` / `NEXT_PUBLIC_RAG_BACKEND_URL`).

## GitHub import

`POST /code/github`

```json
{ "url": "github.com/owner/repo" }
```

Clones the public repo with `git clone --depth 1`, registers files, returns the same shape as `/code/ingest`.

Next.js proxy: `POST /api/code/github` with `{ "url": "..." }`.

Requires **Git** on PATH.

## Index repository

`POST /code/index`

```json
{ "repo_id": "uuid" }
```

Chunks and embeds code files into ChromaDB collection `code_repos`.

Next.js proxy: `POST /api/code/index` with `{ "repoId": "..." }`.

## Ask about codebase

`POST /code/ask`

```json
{
  "repo_id": "uuid",
  "question": "How does the API handle errors?",
  "top_k": 5
}
```

Retrieves relevant chunks, then answers with Ollama. Response includes `answer`, `sources`, `confidence`, `limitations`, and `retrieved` chunks.

Next.js proxy: `POST /api/code/ask` with `{ "repoId", "question" }`.

**Index the repo first** before asking.

## Evaluation metrics

`GET /eval/metrics`

Returns aggregate stats and the last 20 runs logged from pipeline, code map, analyze, ask, index, and GitHub import.

Next.js proxy: `GET /api/eval/metrics`.

Runs are stored in `backend/data/eval_runs.json`.
