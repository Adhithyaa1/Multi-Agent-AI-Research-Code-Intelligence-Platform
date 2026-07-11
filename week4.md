# Week 4 — Solo checklist (multi-agent architecture)

Based on `weekly_plan.md` Phase 4. Week 3 delivered a single research agent. **Week 4 = LangGraph orchestration**: planner → researcher → coder → critic → writer, with a visible agent trace.

---

## Shared setup

| Item | Decision |
|------|----------|
| Orchestration | LangGraph `StateGraph` |
| Agents | `planner`, `researcher`, `coder`, `critic`, `writer` |
| LLM | Local Ollama (`llama3.1`) |
| API | FastAPI `POST /pipeline` |
| UI | Multi-agent panel + agent trace |

**Prerequisites:** Weeks 1–3 working (Ollama, Next.js, Python backend).

```bash
cd backend
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## Track A — Agents (`agents/`)

**Goal:** Five role-specific agents + one LangGraph workflow.

### Layout

```
agents/
├── llm.py            # shared Ollama helper
├── planner.py        # break question into tasks
├── researcher.py     # collect research notes
├── coder.py          # architecture / code-oriented analysis
├── critic.py         # support + hallucination checks
├── writer.py         # final report
├── graph.py          # LangGraph pipeline
└── research_agent.py # Week 3 (still available standalone)
```

### Workflow

```
User question
    ↓
Planner      → tasks[]
    ↓
Researcher   → research notes
    ↓
Coder        → architecture / code notes
    ↓
Critic       → issues / supported? / revisions
    ↓
Writer       → final report
```

### Agent responsibilities

| Agent | Input | Output |
|-------|--------|--------|
| Planner | question | ordered task list |
| Researcher | question + tasks + optional doc context | concepts / evidence / limitations / future work |
| Coder | question + research notes + optional context | architecture / components / risks |
| Critic | all prior notes | supported claims, issues, revision notes |
| Writer | full state | final markdown-style report |

### Integration checklist

- [ ] Each agent runs alone via its module function
- [ ] `run_pipeline(question)` returns report + trace
- [ ] Optional `document_id` grounds researcher/coder in RAG chunks
- [ ] Clear error when Ollama is down

---

## Track B — API + UI

1. **`POST /pipeline`** — run full graph, return report + per-agent trace
2. **`POST /api/pipeline`** — Next.js proxy
3. **UI panel** — question input, run button, agent trace, final report
4. **Docs** — `docs/week4-api.md`

### Integration checklist

- [ ] Curl `/pipeline` returns report and trace
- [ ] UI shows each agent step
- [ ] Active document is passed when present

---

## Definition of done (Week 4)

**Required:**

- [ ] LangGraph pipeline with all five agents
- [ ] End-to-end run from UI or API
- [ ] Agent trace visible (who ran, brief summary)
- [ ] Final report produced by writer
- [ ] All local — no paid APIs

**Stretch:**

- [ ] Ground pipeline in uploaded document
- [ ] Critic can request a single revision pass (optional loop)

---

## Defer to Week 5+

- Full GitHub repo clone / deep code intelligence
- Agent evaluation dashboard
- Deployment

---

## Run

```bash
# Terminal 1
cd backend && .venv\Scripts\activate
uvicorn main:app --reload --port 8000

# Terminal 2
cd research-agent && npm run dev
```
