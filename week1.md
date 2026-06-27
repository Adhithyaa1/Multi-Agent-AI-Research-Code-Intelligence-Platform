Here is a **Week 1 split for two people**, based on `weekly_plan.md`. Week 1 (Phase 1) is: **Next.js UI → API route → Ollama → streaming chat**. The doc’s “Week 1 MVP” also lists PDF upload/Q&A; that overlaps with Week 2 (RAG). Below, **core Week 1 = streaming chat**; **PDF = stretch / prep only** unless you both finish early.

---

## Shared setup (do once, before splitting)

Agree on:

| Item | Decision |
|------|----------|
| Repo name | `research-agent` (per plan) |
| Who scaffolds | **Person A** creates the repo; **Person B** clones after the first push |
| Branch strategy | `main` + feature branches (`person-a/chat-ui`, `person-b/ollama-api`) |
| API contract | See below — both build to this shape |

**API contract (both must match):**

- **Endpoint:** `POST /api/chat`
- **Request body:** `{ "messages": [{ "role": "user" | "assistant", "content": string }] }`
- **Response:** streamed text (SSE or Vercel AI SDK stream)
- **Ollama:** local at `http://localhost:11434`, model `llama3.1`

**Each person’s machine (when you start — not now):**

1. Node.js 18+ and npm  
2. Git  
3. Ollama from [https://ollama.com](https://ollama.com)  
4. Model: `ollama pull llama3.1` then `ollama run llama3.1` (smoke test)

---

## Person A — Frontend (Chat UI)

**Goal:** ChatGPT-like UI that sends messages to `/api/chat` and renders a **streaming** reply.

### Steps

1. **Create the app** (you own the scaffold):
   ```bash
   npx create-next-app research-agent
   ```
   Choose: **TypeScript**, **App Router**, **Tailwind**, ESLint yes, `src/` optional (either is fine — stay consistent).

2. **Push to Git** so Person B can clone the same repo.

3. **Build the chat page** (e.g. `app/page.tsx` or `app/chat/page.tsx`):
   - Message list (user vs assistant)
   - Text input + Send
   - Loading/streaming state (cursor or “Thinking…”)
   - Auto-scroll on new tokens
   - Simple, clean layout (Tailwind)

4. **Wire to the API** using the Vercel AI SDK client pattern:
   - Person B will add `npm install ai` and the route; you consume `useChat` from `ai/react` **or** `fetch` + stream reader — align with whatever Person B implements.
   - Until the route exists, use a **mock**: fake assistant reply after 1s so UI is testable alone.

5. **Define types** shared in code or in a short `docs/api.md`:
   - Message shape: `{ role, content }`
   - Error states: network fail, empty response, 500

6. **Stretch (Week 1 MVP extras):**
   - File upload UI (PDF only): drag-drop + file name display
   - **Do not** implement RAG yet — only UI + “file selected” state
   - Document in README: “Upload wired in Week 2”

7. **Handoff to Person B:**
   - Repo URL
   - Page/route where chat lives
   - Screenshot or short Loom of UI with mock data

8. **Integration checklist (end of week):**
   - [ ] Real stream from Ollama appears in UI  
   - [ ] Multiple turns in one session  
   - [ ] Errors shown in UI (Ollama down, etc.)

---

## Person B — Backend (Ollama + streaming API)

**Goal:** `app/api/chat/route.ts` that talks to **local Ollama** and **streams** back to the frontend.

### Steps

1. **Clone Person A’s repo** after scaffold is pushed.

2. **Install Ollama + model** (on your machine):
   ```bash
   ollama pull llama3.1
   ollama run llama3.1
   ```
   Confirm Ollama serves at `http://localhost:11434`.

3. **Add dependency:**
   ```bash
   npm install ai
   ```

4. **Create `app/api/chat/route.ts`:**
   - Accept `POST` with `{ messages }`
   - Forward to Ollama (HTTP API, e.g. `/api/chat` with `stream: true`)
   - Return a **streaming** response compatible with Person A’s client (`StreamingTextResponse` / AI SDK helpers, or raw SSE)

5. **Test without the UI** (curl, Postman, or a minimal HTML page):
   ```bash
   curl http://localhost:11434/api/tags
   ```
   Then hit your Next route:
   ```bash
   curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}"
   ```
   Confirm tokens stream, not one blob at the end.

6. **Environment / config:**
   - `OLLAMA_BASE_URL=http://localhost:11434` (optional `.env.local`)
   - Model name constant: `llama3.1`
   - Document in README: “Start Ollama before `npm run dev`”

7. **Error handling:**
   - Ollama not running → clear 503 + message  
   - Invalid body → 400  
   - Log errors server-side only

8. **Stretch:**
   - Stub `POST /api/upload` that saves PDF to `uploads/` (no embeddings yet) — pairs with Person A’s upload UI for Week 2

9. **Handoff to Person A:**
   - Exact request/response format
   - Example `fetch` or `useChat` config
   - How to run: `ollama serve` (if needed) + `npm run dev`

10. **Integration checklist:**
    - [ ] Person A’s UI streams real replies  
    - [ ] Conversation history sent correctly (last N messages)  
    - [ ] Works on both machines after `git pull`

---

## Week 1 timeline (suggested)

| Day | Person A | Person B |
|-----|----------|----------|
| 1 | Scaffold Next.js, push repo | Install Ollama, pull model, read Ollama HTTP API |
| 2 | Chat layout + mock responses | `/api/chat` route, curl test |
| 3 | Stream UI (mock or real if route ready) | Streaming + error handling |
| 4 | Polish UI, error states | README backend section, env docs |
| 5 | **Integration** — merge branches, fix contract mismatches | Same |
| 6–7 | Stretch: PDF upload UI | Stretch: upload stub API |

---

## Definition of done (Week 1)

**Required (Phase 1):**

- [ ] Next.js app runs locally (`npm run dev`)
- [ ] Ollama runs locally with `llama3.1`
- [ ] User can type a message and see a **streaming** assistant reply
- [ ] No paid APIs — all inference local

**Stretch (from “First Milestone” in the doc):**

- [ ] PDF file can be selected/uploaded in UI  
- [ ] File stored server-side (no Q&A over PDF until Week 2 RAG)

---

## Avoid blocking each other

1. **Person A goes first** on repo creation (Day 1).  
2. **Lock the API contract** in a one-page `docs/week1-api.md` before coding deep UI/API.  
3. **Person A uses mocks** until Person B’s route works.  
4. **Person B tests with curl** before needing the full UI.  
5. **Merge early** (Day 3–4), not only at end of week.

---

## What to defer to Week 2

Per the plan, do **not** do in Week 1:

- ChromaDB, sentence-transformers, PDF chunking/embedding  
- LangGraph / multi-agent  
- Vercel deployment (Week 8)

Week 2 is when Person B (or a shared Python `backend/`) adds ingestion + RAG; Person A connects upload UI to that pipeline.

If you want, I can turn this into a copy-paste **Person A checklist** and **Person B checklist** as separate markdown files in the repo (still without installing anything).

