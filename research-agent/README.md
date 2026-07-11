# research-agent

Next.js frontend for the Multi-Agent AI Research + Code Intelligence Platform.

For product overview, architecture, tools, and full setup, see the **[root README](../README.md)**.

## Local run

```powershell
copy .env.local.example .env.local
npm install
npm run dev
```

Requires the Python backend on port 8000 and Ollama with `llama3.1`.

## API notes

Route-level docs live in [docs/](./docs/).
