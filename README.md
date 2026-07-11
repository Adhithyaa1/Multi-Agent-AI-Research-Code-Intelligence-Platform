# Multi-Agent AI Research + Code Intelligence Platform

Local-first web app for research Q&A and codebase analysis. Upload a paper, import a GitHub repo, then chat, generate structured notes, run a multi-agent report pipeline, or let a tool-calling assistant pick the right search for you — all powered by **Ollama** (no paid LLM APIs).

**Live UI (frontend only):** [multi-agent-research-agent-seven.vercel.app](https://multi-agent-research-agent-seven.vercel.app)

---

## What it does

### Session library (shared context)

Keep **one document** and **one repository** available across every tool:

| Slot | How to add | Used by |
|------|------------|---------|
| Document | Upload PDF / `.md` / `.txt` | Chat, Research notes, Full report, Smart assistant |
| Repository | GitHub URL or folder upload → optional **Index for Q&A** | Code intelligence, Smart assistant |

Add or remove either slot anytime. Context persists while you switch tools (and in browser `sessionStorage` for the tab).

### Tools

| Tool | What it does |
|------|----------------|
| **Chat** | Streaming conversation with the local model; answers from your uploaded document when one is loaded (RAG). |
| **Research notes** | Structured output: concepts, evidence, limitations, future work, summary — optionally grounded in the document. |
| **Code intelligence** | Repo map, per-file explain / find bugs / suggest improvements, and semantic Q&A over an indexed codebase. |
| **Full report** | LangGraph pipeline: Planner → Researcher → Coder → Critic → Writer, with a live agent trace. |
| **Smart assistant** | Vercel AI SDK agent that calls tools (`searchDocuments`, `searchCodeRepo`, `getResearchNotes`) as needed. |
| **Metrics** | Operator tab: run counts, average duration, critic confidence, recent runs. |

---

## Architecture

```
Browser
   │
   ▼
Next.js (research-agent/)          ports 3000 / Vercel
   ├── Session library UI
   ├── Tool modes (chat, research, code, pipeline, agent)
   └── API routes → Ollama and/or FastAPI
   │
   ▼
FastAPI (backend/)                 port 8000
   ├── Document RAG (chunk → embed → ChromaDB)
   ├── Code ingest / GitHub clone / code index
   ├── LangGraph multi-agent pipeline
   └── Eval metrics store
   │
   ▼
Ollama                             port 11434
   └── llama3.1 (default)
```

| Layer | Stack |
|-------|--------|
| Frontend | Next.js 16, React 19, Tailwind, Vercel AI SDK |
| Backend | FastAPI, ChromaDB, sentence-transformers (`all-MiniLM-L6-v2`) |
| Agents | LangGraph (planner, researcher, coder, critic, writer) |
| LLM | Ollama via OpenAI-compatible API |

---

## Prerequisites

1. **Node.js 18+** and npm  
2. **Python 3.10+**  
3. **Git** (for GitHub import)  
4. **Ollama** with `llama3.1` — [ollama.com/download](https://ollama.com/download)

```powershell
ollama pull llama3.1
```

---

## Quick start

**Terminal 1 — Ollama** (if not already running as a service)

```powershell
ollama serve
```

**Terminal 2 — Python backend**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000 --reload-exclude 'data'
```

Or: `.\run-dev.ps1`

**Terminal 3 — Next.js frontend**

```powershell
cd research-agent
copy .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Health checks:

- Backend: `http://localhost:8000/health`
- App: `http://localhost:3000/api/health`

---

## Typical workflow

1. In **Session library**, upload a PDF and/or import a GitHub repo.  
2. For code Q&A / Smart assistant code search, click **Index for Q&A**.  
3. Open a tool from the hub (Chat, Research notes, Code intelligence, Full report, or Smart assistant).  
4. Switch tools freely — the same document and repo stay loaded.  
5. Use the **Metrics** tab to inspect run timings.

---

## Project layout

```
├── research-agent/          Next.js app (UI + API routes)
│   ├── app/api/             chat, agent, upload, research, pipeline, code/*, eval, health
│   ├── components/          SessionLibrary, ModeHub, Chat, panels…
│   └── lib/                 Ollama client, RAG client, agent tools, modes
├── backend/                 FastAPI RAG + code intelligence + metrics
│   ├── main.py              HTTP API
│   ├── ingestion.py         Document chunking
│   ├── embeddings.py        ChromaDB document store
│   ├── code_index.py        Code chunking / retrieval
│   ├── github_clone.py      Public repo clone
│   └── eval_store.py        Run metrics
├── agents/                  LangGraph + research / code agents
│   ├── graph.py             Multi-agent pipeline
│   ├── planner.py … writer.py
│   └── code_intelligence.py
├── DEPLOYMENT.md            Vercel / Docker / ngrok / Render
└── .env.example             Environment variable reference
```

---

## Main APIs

### Next.js (`research-agent`)

| Route | Purpose |
|-------|---------|
| `POST /api/chat` | Streaming chat (+ optional document RAG) |
| `POST /api/agent` | Tool-calling smart assistant |
| `POST /api/upload` | Document upload → backend ingest |
| `POST /api/research` | Structured research notes |
| `POST /api/pipeline` | Multi-agent report (non-stream) |
| `POST /api/code/*` | GitHub import, index, map, analyze, ask |
| `GET /api/eval/metrics` | Evaluation dashboard data |
| `GET /api/health` | Ollama + backend reachability |

### FastAPI (`backend`, port 8000)

| Route | Purpose |
|-------|---------|
| `POST /ingest`, `POST /retrieve` | Document RAG |
| `POST /research`, `POST /pipeline`, `POST /pipeline/stream` | Research + multi-agent |
| `POST /code/github`, `/code/ingest`, `/code/index`, `/code/retrieve`, `/code/ask`, `/code/map`, `/code/analyze` | Code intelligence |
| `GET /eval/metrics` | Metrics JSON |
| `GET /health` | Liveness |

More detail: [research-agent/docs/](./research-agent/docs/).

---

## Environment

Copy [research-agent/.env.local.example](./research-agent/.env.local.example):

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
RAG_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_RAG_BACKEND_URL=http://localhost:8000
```

Backend CORS (when the UI is not on localhost):

```env
CORS_ALLOW_ORIGINS=http://localhost:3000,https://your-app.vercel.app
```

---

## Deployment

Vercel hosts the **frontend only**. The Python backend and Ollama must run elsewhere (your machine + [ngrok](https://ngrok.com), Docker, or Render).

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for:

- Vercel env vars  
- ngrok tunnel to local FastAPI  
- Docker Compose / Render backend  

---

## CLI smoke tests

From the repo root (with Ollama running and `backend` deps installed):

```powershell
python -m agents.research_agent "Compare Vision Transformers and CNNs"
python -m agents.graph "Analyze YOLO vs DETR"
```

A full multi-agent run makes several sequential LLM calls and can take 1–3 minutes on CPU.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ollama` not found / chat 503 | Install Ollama, pull `llama3.1`, ensure it is running on `:11434` |
| “Backend not running” | Start FastAPI on `:8000`; use `--reload-exclude 'data'` so GitHub clones don’t restart the server |
| GitHub import path errors (Windows) | Enable Win32 long paths, or use a smaller repo / folder upload |
| Pipeline / agent very slow | Expected on CPU — five+ local model calls |
| Vercel UI loads but AI fails | Set `RAG_BACKEND_URL` / `NEXT_PUBLIC_RAG_BACKEND_URL` to a public backend URL (e.g. ngrok) |

---

## License

MIT — see [LICENSE](./LICENSE).
