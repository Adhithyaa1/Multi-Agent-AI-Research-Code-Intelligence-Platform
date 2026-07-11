# Week 5 API Contract

Phase 5 adds code intelligence: upload a project, map its structure, and analyze individual files.

## Endpoints (Python backend `:8000`)

### `POST /code/ingest`

Register an uploaded project directory.

**Request**

```json
{
  "repo_path": "C:/absolute/path/to/uploads/code/123-code",
  "name": "my-project"
}
```

**Response**

```json
{
  "repo_id": "uuid",
  "name": "my-project",
  "file_count": 5,
  "files": ["model.py", "train.py", "utils.py"]
}
```

### `POST /code/map`

Generate a repository map (logical components).

**Request**

```json
{ "repo_id": "uuid" }
```

**Response**

```json
{
  "repo_id": "uuid",
  "project_name": "my-project",
  "components": [
    {
      "name": "Model",
      "files": ["model.py"],
      "description": "Neural network definitions"
    }
  ],
  "summary": "..."
}
```

### `POST /code/analyze`

Analyze a single file.

**Request**

```json
{
  "repo_id": "uuid",
  "file": "model.py",
  "mode": "explain",
  "question": "optional"
}
```

`mode`: `explain` | `bugs` | `improve`

**Response (explain)**

```json
{
  "mode": "explain",
  "file": "model.py",
  "summary": "...",
  "key_elements": ["..."],
  "data_flow": "...",
  "dependencies": ["..."]
}
```

**Response (bugs)**

```json
{
  "mode": "bugs",
  "file": "train.py",
  "summary": "...",
  "issues": [
    {
      "line": 42,
      "severity": "high",
      "description": "optimizer.zero_grad missing",
      "suggestion": "Call zero_grad before backward"
    }
  ]
}
```

**Response (improve)**

```json
{
  "mode": "improve",
  "file": "model.py",
  "summary": "...",
  "suggestions": [
    {
      "title": "Use ViT backbone",
      "description": "...",
      "impact": "..."
    }
  ]
}
```

## Next.js routes

| Route | Purpose |
|-------|---------|
| `POST /api/code/upload` | Save files + register repo |
| `POST /api/code/map` | Proxy to `/code/map` |
| `POST /api/code/analyze` | Proxy to `/code/analyze` |

Supported extensions: `.py`, `.js`, `.ts`, `.tsx`, `.jsx`, `.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.rs`, `.go`, `.java`, `.cpp`, `.c`, `.h`, `.cs`

Max 40 files per upload.
