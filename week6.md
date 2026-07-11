# Week 6 — Solo checklist (code intelligence polish)

Based on `weekly_plan.md` Phase 5 (Week 5–6) deferrals and portfolio features. Week 5 delivered upload + map + explain/bugs/improve. **Week 6 = GitHub import, code indexing/Q&A, evaluation dashboard.**

---

## Goals

1. **GitHub integration** — paste `github.com/user/repo` → clone → analyze
2. **Deep code indexing** — chunk + embed repo in ChromaDB
3. **Ask questions about a repo** — RAG over indexed code
4. **Evaluation dashboard** — track run times, agent traces, critic confidence

---

## Architecture

```
GitHub URL → POST /code/github → git clone → register_repo
           → POST /code/index  → ChromaDB (code collection)
           → POST /code/ask    → retrieve + Ollama

Pipeline / analyze runs → eval_store → GET /eval/metrics
```

---

## Definition of done

- [x] Import a public GitHub repo by URL
- [x] Index repo for semantic search
- [x] Ask a question about the codebase
- [x] Dashboard shows recent runs with timings
- [x] All local — no paid APIs

---

## Defer to Week 8+

- _(completed in Week 8 — see DEPLOYMENT.md)_

---

## Run

```bash
cd backend && .venv\Scripts\activate && uvicorn main:app --reload --port 8000
cd research-agent && npm run dev
```

Requires `git` on PATH for GitHub import.
