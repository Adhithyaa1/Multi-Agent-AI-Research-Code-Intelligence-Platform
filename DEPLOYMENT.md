# Deployment Guide

This project splits into a **Next.js frontend** (Vercel) and a **Python AI backend** (Docker / Render / local). Ollama must run where the backend can reach it — not on Vercel.

---

## Architecture

```
Browser
   ↓
Vercel (research-agent/)     env: RAG_BACKEND_URL, NEXT_PUBLIC_RAG_BACKEND_URL
   ↓
FastAPI backend (:8000)      env: CORS_ALLOW_ORIGINS, OLLAMA_BASE_URL
   ↓
Ollama (:11434) + ChromaDB + LangGraph agents
```

---

## Option A — Local development (default)

**Terminal 1 — Ollama**

```powershell
ollama pull llama3.1
ollama serve
```

**Terminal 2 — Backend**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
.\run-dev.ps1
```

Or manually:

```powershell
uvicorn main:app --reload --port 8000 --reload-exclude 'data'
```

**Terminal 3 — Frontend**

```powershell
cd research-agent
cp .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. Health check: http://localhost:3000/api/health

---

## Option B — Docker backend

From the repo root:

```powershell
docker compose up --build
```

Backend runs at http://localhost:8000. Ollama must be reachable at `host.docker.internal:11434` (set in `docker-compose.yml`).

Run the Next.js app locally pointing at the container:

```env
RAG_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_RAG_BACKEND_URL=http://localhost:8000
```

---

## Option C — Vercel frontend + local backend via ngrok

1. Start backend + Ollama locally (Option A).
2. Expose backend: `ngrok http 8000` → copy HTTPS URL.
3. Deploy frontend to Vercel (import `research-agent/` as root or monorepo subfolder).

**Vercel environment variables:**

| Variable | Example |
|----------|---------|
| `OLLAMA_BASE_URL` | `http://your-machine:11434` or tunnel URL if proxied |
| `RAG_BACKEND_URL` | `https://abc123.ngrok.io` |
| `NEXT_PUBLIC_RAG_BACKEND_URL` | Same as above (client-side pipeline stream) |

4. Set backend CORS:

```env
CORS_ALLOW_ORIGINS=https://your-app.vercel.app,http://localhost:3000
```

Restart the backend after changing CORS.

---

## Option D — Render backend (Docker)

1. Push repo to GitHub.
2. Create a **Web Service** on [Render](https://render.com) using `render.yaml` or manual Docker deploy.
3. Set environment variables in Render dashboard:

| Variable | Value |
|----------|-------|
| `CORS_ALLOW_ORIGINS` | Your Vercel URL |
| `OLLAMA_BASE_URL` | URL of Ollama instance (must be network-reachable) |

4. Add a persistent disk for `/app/backend/data` (ChromaDB + eval logs) if you need data to survive redeploys.

**Note:** Render free tier sleeps after inactivity. Ollama is heavy — for production demos, run Ollama on a GPU machine and point `OLLAMA_BASE_URL` at it.

---

## Vercel deploy (today)

1. Push this repo to GitHub.
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Set **Root Directory** to `research-agent`.
4. Add environment variables (see `.env.example`). Minimum for a live UI:
   - `RAG_BACKEND_URL` — your backend URL (ngrok, Render, or local tunnel)
   - `NEXT_PUBLIC_RAG_BACKEND_URL` — same URL (used by browser for pipeline/code)
   - `OLLAMA_BASE_URL` — where Ollama is reachable from Vercel serverless functions
5. Deploy. Set backend `CORS_ALLOW_ORIGINS` to include your `*.vercel.app` URL.

Without a reachable backend + Ollama, the UI loads but AI features return errors — use ngrok for a quick demo.

---

## Health checks

| Endpoint | Purpose |
|----------|---------|
| `GET /health` (backend) | FastAPI alive |
| `GET /api/health` (Next.js) | Ollama + backend reachability |

---

## Environment reference

See [.env.example](./.env.example) and [research-agent/.env.local.example](./research-agent/.env.local.example).

---

## Limitations

- Vercel serverless functions have timeout limits (60–300s depending on plan). Long multi-agent pipeline runs should use client-side streaming to the Python backend (`NEXT_PUBLIC_RAG_BACKEND_URL`).
- Ollama tool calling quality varies by model; `llama3.1` is the tested default.
- ChromaDB and uploaded files are local to the backend instance unless you mount persistent storage.
