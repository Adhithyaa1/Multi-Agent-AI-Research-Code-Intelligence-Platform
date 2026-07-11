# Week 5 — Solo checklist (code intelligence)

Based on `weekly_plan.md` Phase 5. Weeks 1–4 delivered chat, RAG, research agent, and multi-agent pipeline. **Week 5 = code intelligence**: upload a project, get a repo map, explain files, find bugs, suggest improvements.

---

## Goal

User uploads a small codebase (e.g. `model.py`, `train.py`, `utils.py`) and can:

1. **Repository map** — high-level structure (Data Pipeline, Model, Training, Evaluation)
2. **Explain code** — "Explain model.py"
3. **Find bugs** — line-level potential issues
4. **Suggest improvements** — actionable refactors

All local via Ollama — no paid APIs.

---

## Architecture

```
Browser → POST /api/code/upload → save files → Python /code/ingest
Browser → POST /api/code/map    → Python /code/map    → repo map
Browser → POST /api/code/analyze → Python /code/analyze → explain | bugs | improve
```

---

## Track A — Backend (`agents/code_intelligence.py`, `backend/code_store.py`)

### Layout

```
backend/
├── code_store.py       # repo registry, file loading
agents/
└── code_intelligence.py  # map, explain, bugs, improve
```

### Steps

1. **Code upload storage** — `uploads/code/{repo_id}/` with relative paths preserved
2. **Supported extensions** — `.py`, `.js`, `.ts`, `.tsx`, `.md`, `.txt`, `.json`, etc.
3. **Repo map** — LLM groups files into logical components
4. **Analyze modes** — `explain`, `bugs`, `improve` on a selected file

### Integration checklist

- [ ] Upload 3+ files → `repo_id` returned
- [ ] Map shows component tree
- [ ] Explain returns readable summary
- [ ] Bugs returns line references
- [ ] Improve returns suggestions

---

## Track B — Next.js UI

1. **Code upload panel** — multi-file / folder picker
2. **Repo map display** — tree view after upload
3. **File selector + mode tabs** — Explain / Bugs / Improve
4. **Docs** — `docs/week5-api.md`

---

## Definition of done

- [ ] Upload a small Python project
- [ ] See repository map
- [ ] Explain a file by name
- [ ] Find bugs in a file
- [ ] Get improvement suggestions
- [ ] All local — Ollama only

---

## Defer to Week 6+

- GitHub URL clone / deep repo indexing
- Evaluation dashboard
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
