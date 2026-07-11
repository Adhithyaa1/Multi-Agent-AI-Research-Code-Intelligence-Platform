# Week 2 — Solo checklist (RAG / document Q&A)

Based on `weekly_plan.md` Phase 2. Week 1 delivered streaming chat + PDF upload storage. **Week 2 = RAG**: chunk documents, embed them, store in ChromaDB, and answer questions using retrieved context + Ollama.

---

## Shared setup (do once)

| Item | Decision |
|------|----------|
| Vector DB | ChromaDB (persistent, local) |
| Embeddings | `sentence-transformers` — `all-MiniLM-L6-v2` |
| PDF parsing | `pypdf` |
| Python API | FastAPI on `http://localhost:8000` |
| Next.js integration | `RAG_BACKEND_URL` env var |
| API contract | [research-agent/docs/week2-api.md](./research-agent/docs/week2-api.md) |

**Prerequisites (your machine):**

1. Week 1 app working (Ollama + `npm run dev`)
2. Python 3.10+
3. pip

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## Track A — Python RAG backend (`backend/`)

**Goal:** Ingest documents → chunk → embed → ChromaDB → retrieve relevant chunks for a query.

### Steps

1. **Create `backend/` layout:**
   ```
   backend/
   ├── main.py           # FastAPI app
   ├── config.py
   ├── ingestion.py      # PDF / text chunking
   ├── embeddings.py     # sentence-transformers + ChromaDB
   ├── retrieval.py      # similarity search
   └── requirements.txt
   ```

2. **`ingestion.py`:**
   - Load PDF via `pypdf`, plain text via `.md` / `.txt`
   - Chunk text (~1000 chars, 200 overlap)
   - Return list of `{ text, chunk_index, source }`

3. **`embeddings.py`:**
   - Load `all-MiniLM-L6-v2` once (singleton)
   - Persist ChromaDB collection at `backend/data/chroma/`
   - `ingest_chunks(document_id, filename, chunks)` → store with metadata

4. **`retrieval.py`:**
   - `retrieve(document_id, query, top_k=4)` → ranked chunks

5. **`main.py` endpoints:**
   - `GET /health` — backend alive
   - `POST /ingest` — `{ file_path }` → `{ document_id, filename, chunk_count }`
   - `POST /retrieve` — `{ document_id, query, top_k? }` → `{ chunks }`

6. **Test with curl (no UI):**
   ```bash
   curl http://localhost:8000/health
   curl -X POST http://localhost:8000/ingest -H "Content-Type: application/json" \
     -d "{\"file_path\": \"C:/path/to/paper.pdf\"}"
   curl -X POST http://localhost:8000/retrieve -H "Content-Type: application/json" \
     -d "{\"document_id\": \"...\", \"query\": \"What is the main contribution?\"}"
   ```

7. **Error handling:**
   - Missing file → 400
   - Unsupported type → 400
   - Empty document → 400

### Integration checklist

- [ ] PDF ingests and returns `chunk_count > 0`
- [ ] Retrieve returns relevant chunks for a test query
- [ ] ChromaDB persists across server restarts

---

## Track B — Next.js integration (`research-agent/`)

**Goal:** Upload triggers ingestion; chat uses retrieved context when a document is active.

### Steps

1. **Env:** add `RAG_BACKEND_URL=http://localhost:8000` to `.env.local`

2. **`lib/rag-client.ts`:** helpers to call Python `/ingest`, `/retrieve`, `/health`

3. **Update `POST /api/upload`:**
   - Save file (existing)
   - Call Python `/ingest` with absolute path
   - Return `{ documentId, chunkCount, ingested: true, ... }`

4. **Update `POST /api/chat`:**
   - Accept optional `documentId` in body
   - If present: retrieve top chunks for latest user message → inject as system context → stream Ollama reply
   - If RAG backend down → 503 with clear message

5. **UI updates:**
   - Share active document state between upload + chat (React context or lifted state)
   - After upload: show “Ready for Q&A” + chunk count
   - Chat header: “Answering about: paper.pdf” when document active
   - `useChat` sends `documentId` in request body

6. **Support file types:** PDF, `.md`, `.txt` (README stretch from plan)

7. **Docs:** `docs/week2-api.md`, update README

### Integration checklist

- [ ] Upload PDF → ingested → chunk count shown in UI
- [ ] Ask question with active document → answer uses document content
- [ ] Chat without document still works (plain Ollama mode)
- [ ] Errors shown when Python backend is not running

---

## Week 2 timeline (suggested, solo)

| Day | Focus |
|-----|-------|
| 1 | Python backend scaffold, ingestion + chunking |
| 2 | Embeddings + ChromaDB + retrieval |
| 3 | FastAPI endpoints, curl tests |
| 4 | Next.js upload → ingest wiring |
| 5 | Chat RAG mode + UI polish |
| 6–7 | README/md support, edge cases, docs |

---

## Definition of done (Week 2)

**Required:**

- [ ] Python RAG backend runs locally (`uvicorn main:app`)
- [ ] Upload PDF → chunked + embedded in ChromaDB
- [ ] User can ask questions **about the uploaded document**
- [ ] Answers grounded in retrieved chunks (not pure hallucination)
- [ ] All local — no paid APIs

**Stretch:**

- [ ] Support `README.md` and `.txt` uploads
- [ ] Show retrieved source snippets in UI (citations preview)

---

## Defer to Week 3+

- LangGraph / research agent
- Multi-agent orchestration
- Code repo analysis
- Deployment

---

## Run both services

Terminal 1 — RAG backend:
```bash
cd backend
.venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

Terminal 2 — Next.js:
```bash
cd research-agent
npm run dev
```

Ollama should already be running in the background (Windows app).
