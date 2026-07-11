# Week 3 — Solo checklist (first agent)

Based on `weekly_plan.md` Phase 3. Weeks 1–2 delivered streaming chat and RAG. **Week 3 = your first agent**: a dedicated research agent with a fixed role, input/output shape, and prompt — not multi-agent orchestration yet (that’s Week 4 / LangGraph).

---

## Shared setup (do once)

| Item | Decision |
|------|----------|
| Agent module | `agents/research_agent.py` (repo root) |
| LLM | Local Ollama (`llama3.1`) |
| API | FastAPI `POST /research` on port 8000 |
| Next.js | `POST /api/research` proxy + Research UI panel |
| Optional context | If `document_id` is set, pull RAG chunks first |

**Prerequisites:**

1. Week 1–2 working (Ollama + Next.js + Python backend)
2. Python backend venv activated

```bash
cd backend
.venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

---

## Track A — Research agent (`agents/`)

**Goal:** Given a research question, produce structured **research notes**.

### Steps

1. **Create layout:**
   ```
   agents/
   ├── __init__.py
   └── research_agent.py
   ```

2. **Define I/O contract:**
   - **Input:** `question: str`, optional `document_id` / context chunks
   - **Output:** research notes with:
     - important concepts
     - evidence
     - limitations
     - future work

3. **System prompt (from plan):**
   ```
   You are a research assistant.

   Find:
   - important concepts
   - evidence
   - limitations
   - future work
   ```

4. **Call Ollama** (non-streaming is fine for structured notes):
   - Prefer JSON-shaped notes for the UI
   - Fall back to plain text sections if parsing fails

5. **Optional RAG:** when `document_id` is provided, retrieve chunks and include them as context so notes are grounded in the uploaded document.

6. **CLI smoke test:**
   ```bash
   python -m agents.research_agent "Compare Vision Transformers and CNNs for medical imaging"
   ```

### Integration checklist

- [ ] `run_research(question)` returns notes with all four sections
- [ ] Works without a document (general research mode)
- [ ] Works with `document_id` (document-grounded notes)
- [ ] Clear error when Ollama is down

---

## Track B — Backend + UI wiring

**Goal:** Call the agent from FastAPI and the web app.

### Steps

1. **`POST /research` on FastAPI:**
   - Body: `{ "question": "...", "document_id": "..."? }`
   - Response: structured research notes

2. **Next.js `POST /api/research`:**
   - Proxy to Python backend
   - Surface `rag_unavailable` / Ollama errors clearly

3. **UI panel:**
   - Question input + “Run research” button
   - Render concepts / evidence / limitations / future work
   - Use active document when one is uploaded (Week 2)

4. **Docs:** `docs/week3-api.md`, update README

### Integration checklist

- [ ] Curl `POST /research` returns notes
- [ ] UI shows structured sections
- [ ] Active document is passed through when present

---

## Week 3 timeline (suggested, solo)

| Day | Focus |
|-----|-------|
| 1 | `research_agent.py` + Ollama call + structured prompt |
| 2 | JSON notes parsing + CLI test |
| 3 | Optional RAG context path |
| 4 | FastAPI `/research` endpoint |
| 5 | Next.js API + UI panel |
| 6–7 | Polish errors, docs |

---

## Definition of done (Week 3)

**Required:**

- [ ] `agents/research_agent.py` exists
- [ ] Input = research question; output = research notes
- [ ] Notes cover concepts, evidence, limitations, future work
- [ ] Callable via API and/or UI (demoable end-to-end)
- [ ] All local — no paid APIs

**Stretch:**

- [ ] Ground notes in an uploaded document when one is active
- [ ] Show which document was used in the UI

---

## Defer to Week 4+

- LangGraph state machine
- Planner / coder / critic / writer agents
- Multi-agent orchestration

---

## Run everything

```bash
# Terminal 1 — backend (RAG + research agent)
cd backend
.venv\Scripts\activate
uvicorn main:app --reload --port 8000

# Terminal 2 — Next.js
cd research-agent
npm run dev
```

Ollama should be running in the background with `llama3.1`.
