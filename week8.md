# Week 8 — Solo checklist (deployment)

Based on `weekly_plan.md` Phase 7. **Week 8 = deploy frontend + document backend hosting.**

---

## Goals

1. **Vercel** — deploy Next.js frontend
2. **Backend hosting** — Docker image + Render blueprint (or local + ngrok)
3. **Environment config** — CORS, backend URLs, health checks
4. **Deployment guide** — `DEPLOYMENT.md`

---

## Architecture

```
Vercel (Next.js)  →  RAG_BACKEND_URL  →  FastAPI (:8000)
                                              ├── ChromaDB
                                              ├── LangGraph agents
                                              └── Ollama (local or remote)
```

Ollama cannot run on Vercel. Options:
- Keep Ollama on your machine; expose backend via ngrok/Render
- Point `OLLAMA_BASE_URL` at a remote Ollama instance

---

## Definition of done

- [x] `Dockerfile` + `docker-compose.yml` for backend
- [x] `render.yaml` for Render deploy
- [x] CORS configurable via `CORS_ALLOW_ORIGINS`
- [x] `.env.example` files
- [x] `GET /api/health` checks Ollama + backend
- [x] `DEPLOYMENT.md` with step-by-step instructions

---

## Quick deploy

See [DEPLOYMENT.md](./DEPLOYMENT.md).
