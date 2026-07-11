# Week 7 — Solo checklist (Vercel AI SDK tools)

Based on `weekly_plan.md` Phase 6. **Week 7 = tool-calling agent with streaming, structured outputs, and document/code tools.**

---

## Goals

1. **Tool-calling agent** — Vercel AI SDK `streamText` + tools + multi-step loop
2. **Search tool** — retrieve document passages (RAG)
3. **Repo tool** — retrieve indexed code snippets
4. **Structured research** — `getResearchNotes` tool + `POST /api/research/structured` via `generateObject`

---

## Architecture

```
User → POST /api/agent → streamText (Ollama)
              ├── searchDocuments → /retrieve
              ├── searchCodeRepo  → /code/retrieve
              └── getResearchNotes → /research

Structured notes → POST /api/research/structured → generateObject (Zod schema)
```

---

## Definition of done

- [x] Agent chat panel with visible tool invocations
- [x] Document search tool when PDF is uploaded
- [x] Code search tool when repo is indexed
- [x] Structured research notes tool
- [x] `generateObject` endpoint for structured outputs

---

## Run

```bash
cd backend && .venv\Scripts\activate && uvicorn main:app --reload --port 8000
cd research-agent && npm run dev
```

Upload a document and/or import + index a repo, then use the **Tool-calling agent** panel.

---

## Defer to Week 8

- Vercel deployment
- Docker / Render backend hosting
