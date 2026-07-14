from __future__ import annotations

import json
import re
import sys
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import Literal

from pydantic import BaseModel, Field

from code_index import index_repo, retrieve_code
from code_store import file_tree, get_repo, numbered_content, read_file, register_repo
from config import (
    CODE_EXTENSIONS,
    CODE_REPOS_DIR,
    CORS_ALLOW_ORIGINS,
    MAX_CODE_FILES,
    REPO_ROOT,
    RESEARCH_TOP_K,
    SUPPORTED_EXTENSIONS,
    UPLOADS_DIR,
)
from embeddings import ingest_document
from eval_store import get_metrics, log_run
from github_clone import clone_github_repo
from retrieval import retrieve_chunks

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from agents.code_intelligence import analyze_file, ask_repo, generate_repo_map
from agents.graph import run_pipeline, run_pipeline_stream
from agents.llm import AgentLLMError
from agents.research_agent import ResearchAgentError, run_research

app = FastAPI(title="Research Agent Backend", version="0.6.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class IngestRequest(BaseModel):
    file_path: str
    document_id: str | None = None


class IngestResponse(BaseModel):
    document_id: str
    filename: str
    chunk_count: int


class RetrieveRequest(BaseModel):
    document_id: str
    query: str
    top_k: int = Field(default=4, ge=1, le=10)


class RetrievedChunk(BaseModel):
    text: str
    score: float | None = None
    metadata: dict


class RetrieveResponse(BaseModel):
    chunks: list[RetrievedChunk]


class ResearchRequest(BaseModel):
    question: str
    document_id: str | None = None
    top_k: int = Field(default=RESEARCH_TOP_K, ge=1, le=10)


class ResearchResponse(BaseModel):
    question: str
    important_concepts: list[str]
    evidence: list[str]
    limitations: list[str]
    future_work: list[str]
    summary: str
    grounded_in_document: bool
    document_id: str | None = None


class PipelineRequest(BaseModel):
    question: str
    document_id: str | None = None
    top_k: int = Field(default=RESEARCH_TOP_K, ge=1, le=10)


class TraceStep(BaseModel):
    agent: str
    status: str
    summary: str
    duration_ms: int


class PipelineResponse(BaseModel):
    question: str
    document_id: str | None = None
    grounded_in_document: bool
    tasks: list[str]
    plan_summary: str
    research_notes: dict
    code_analysis: dict
    critique: dict
    final_report: dict
    trace: list[TraceStep]


class CodeIngestRequest(BaseModel):
    repo_path: str
    name: str | None = None


class CodeIngestResponse(BaseModel):
    repo_id: str
    name: str
    file_count: int
    files: list[str]


class CodeMapRequest(BaseModel):
    repo_id: str


class CodeAnalyzeRequest(BaseModel):
    repo_id: str
    file: str
    mode: Literal["explain", "bugs", "improve"]
    question: str | None = None


class CodeGithubRequest(BaseModel):
    url: str


class CodeIndexRequest(BaseModel):
    repo_id: str


class CodeAskRequest(BaseModel):
    repo_id: str
    question: str
    top_k: int = Field(default=5, ge=1, le=10)


class CodeRetrieveRequest(BaseModel):
    repo_id: str
    query: str
    top_k: int = Field(default=5, ge=1, le=10)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ingest", response_model=IngestResponse)
def ingest(request: IngestRequest) -> IngestResponse:
    try:
        result = ingest_document(request.file_path, request.document_id)
        return IngestResponse(**result)
    except FileNotFoundError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Ingestion failed.") from error


def _safe_filename(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", Path(name).name)
    return cleaned or "upload.bin"


@app.post("/ingest/upload", response_model=IngestResponse)
async def ingest_upload(file: UploadFile = File(...)) -> IngestResponse:
    """Accept a document upload, save on the backend, and ingest into ChromaDB."""
    original = file.filename or "document.txt"
    suffix = Path(original).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Supported types: PDF, Markdown (.md), and plain text (.txt).",
        )

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    saved_name = f"{int(time.time() * 1000)}-{_safe_filename(original)}"
    target = UPLOADS_DIR / saved_name

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        target.write_bytes(content)
        result = ingest_document(str(target))
        return IngestResponse(**result)
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Ingestion failed.") from error


@app.post("/code/upload", response_model=CodeIngestResponse)
async def code_upload(files: list[UploadFile] = File(...)) -> CodeIngestResponse:
    """Accept code files from the browser and register them as a repository."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    repo_dir = CODE_REPOS_DIR / f"upload-{uuid.uuid4().hex[:12]}"
    repo_dir.mkdir(parents=True, exist_ok=True)
    project_name = "uploaded-project"
    saved = 0

    try:
        for upload in files[:MAX_CODE_FILES]:
            raw_name = upload.filename or ""
            rel = raw_name.replace("\\", "/").lstrip("./")
            rel = re.sub(r"\.\.+", "_", rel)
            if not rel:
                continue
            suffix = Path(rel).suffix.lower()
            if suffix not in CODE_EXTENSIONS:
                continue
            if "/" in rel:
                project_name = rel.split("/")[0] or project_name

            target = repo_dir / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            content = await upload.read()
            target.write_bytes(content)
            saved += 1

        if saved == 0:
            raise HTTPException(
                status_code=400,
                detail="No supported code files (.py, .js, .ts, etc.).",
            )

        repo = register_repo(str(repo_dir), project_name)
        return CodeIngestResponse(
            repo_id=repo.repo_id,
            name=repo.name,
            file_count=len(repo.files),
            files=[f.path for f in repo.files],
        )
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Code upload failed.") from error


@app.post("/retrieve", response_model=RetrieveResponse)
def retrieve(request: RetrieveRequest) -> RetrieveResponse:
    try:
        chunks = retrieve_chunks(
            document_id=request.document_id,
            query=request.query,
            top_k=request.top_k,
        )
        return RetrieveResponse(chunks=chunks)
    except Exception as error:
        raise HTTPException(status_code=500, detail="Retrieval failed.") from error


@app.post("/research", response_model=ResearchResponse)
def research(request: ResearchRequest) -> ResearchResponse:
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    context_chunks: list[str] | None = None

    if request.document_id:
        try:
            retrieved = retrieve_chunks(
                document_id=request.document_id,
                query=question,
                top_k=request.top_k,
            )
            context_chunks = [
                chunk["text"] for chunk in retrieved if chunk.get("text")
            ]
        except Exception as error:
            raise HTTPException(
                status_code=500,
                detail="Failed to retrieve document context for research.",
            ) from error

    try:
        notes = run_research(
            question,
            context_chunks=context_chunks,
            document_id=request.document_id,
        )
        return ResearchResponse(**notes.to_dict())
    except ResearchAgentError as error:
        message = str(error)
        status = 503 if "Ollama" in message else 500
        raise HTTPException(status_code=status, detail=message) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Research agent failed.") from error


def _resolve_pipeline_context(request: PipelineRequest) -> tuple[str, list[str] | None]:
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    context_chunks: list[str] | None = None

    if request.document_id:
        try:
            retrieved = retrieve_chunks(
                document_id=request.document_id,
                query=question,
                top_k=request.top_k,
            )
            context_chunks = [
                chunk["text"] for chunk in retrieved if chunk.get("text")
            ]
        except Exception as error:
            raise HTTPException(
                status_code=500,
                detail="Failed to retrieve document context for pipeline.",
            ) from error

    return question, context_chunks


@app.post("/pipeline", response_model=PipelineResponse)
def pipeline(request: PipelineRequest) -> PipelineResponse:
    question, context_chunks = _resolve_pipeline_context(request)
    started = time.perf_counter()

    try:
        result = run_pipeline(
            question,
            context_chunks=context_chunks,
            document_id=request.document_id,
        )
        duration_ms = int((time.perf_counter() - started) * 1000)
        critique = result.get("critique") or {}
        log_run(
            "pipeline",
            duration_ms,
            metadata={
                "question": question[:120],
                "grounded": bool(request.document_id),
                "critic_confidence": critique.get("confidence"),
                "trace_agents": len(result.get("trace") or []),
            },
        )
        return PipelineResponse(**result)
    except AgentLLMError as error:
        message = str(error)
        status = 503 if "Ollama" in message else 500
        raise HTTPException(status_code=status, detail=message) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Multi-agent pipeline failed.",
        ) from error


@app.post("/pipeline/stream")
def pipeline_stream(request: PipelineRequest) -> StreamingResponse:
    question, context_chunks = _resolve_pipeline_context(request)

    def event_generator():
        started = time.perf_counter()
        try:
            for event in run_pipeline_stream(
                question,
                context_chunks=context_chunks,
                document_id=request.document_id,
            ):
                if event.get("type") == "done":
                    result = event.get("result") or {}
                    duration_ms = int((time.perf_counter() - started) * 1000)
                    critique = result.get("critique") or {}
                    log_run(
                        "pipeline",
                        duration_ms,
                        metadata={
                            "question": question[:120],
                            "grounded": bool(request.document_id),
                            "critic_confidence": critique.get("confidence"),
                            "trace_agents": len(result.get("trace") or []),
                        },
                    )
                yield f"data: {json.dumps(event)}\n\n"
        except AgentLLMError as error:
            message = str(error)
            payload = {"type": "error", "error": message}
            yield f"data: {json.dumps(payload)}\n\n"
        except Exception:
            payload = {
                "type": "error",
                "error": "Multi-agent pipeline failed unexpectedly.",
            }
            yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/code/ingest", response_model=CodeIngestResponse)
def code_ingest(request: CodeIngestRequest) -> CodeIngestResponse:
    try:
        repo = register_repo(request.repo_path, request.name)
        return CodeIngestResponse(
            repo_id=repo.repo_id,
            name=repo.name,
            file_count=len(repo.files),
            files=[f.path for f in repo.files],
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Code ingest failed.") from error


@app.post("/code/github", response_model=CodeIngestResponse)
def code_github(request: CodeGithubRequest) -> CodeIngestResponse:
    started = time.perf_counter()
    try:
        clone_path, display_name = clone_github_repo(request.url)
        repo = register_repo(str(clone_path), display_name)
        duration_ms = int((time.perf_counter() - started) * 1000)
        log_run(
            "code_github",
            duration_ms,
            metadata={"url": request.url.strip(), "file_count": len(repo.files)},
        )
        return CodeIngestResponse(
            repo_id=repo.repo_id,
            name=repo.name,
            file_count=len(repo.files),
            files=[f.path for f in repo.files],
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="GitHub import failed.") from error


@app.post("/code/index")
def code_index(request: CodeIndexRequest) -> dict:
    started = time.perf_counter()
    try:
        result = index_repo(request.repo_id)
        duration_ms = int((time.perf_counter() - started) * 1000)
        log_run(
            "code_index",
            duration_ms,
            metadata={
                "repo_id": request.repo_id,
                "indexed_chunks": result.get("indexed_chunks"),
            },
        )
        return result
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Code indexing failed.") from error


@app.post("/code/retrieve")
def code_retrieve(request: CodeRetrieveRequest) -> dict:
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query must not be empty.")

    try:
        chunks = retrieve_code(request.repo_id, query, top_k=request.top_k)
        return {"repo_id": request.repo_id, "chunks": chunks}
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Code retrieval failed.") from error


@app.post("/code/ask")
def code_ask(request: CodeAskRequest) -> dict:
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    started = time.perf_counter()
    try:
        chunks = retrieve_code(request.repo_id, question, top_k=request.top_k)
        result = ask_repo(question, chunks)
        duration_ms = int((time.perf_counter() - started) * 1000)
        log_run(
            "code_ask",
            duration_ms,
            metadata={
                "repo_id": request.repo_id,
                "confidence": result.get("confidence"),
                "retrieved_chunks": result.get("retrieved_chunks"),
            },
        )
        result["retrieved"] = chunks
        return result
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AgentLLMError as error:
        message = str(error)
        status = 503 if "Ollama" in message else 500
        raise HTTPException(status_code=status, detail=message) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Code Q&A failed.") from error


@app.get("/eval/metrics")
def eval_metrics() -> dict:
    try:
        return get_metrics()
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load evaluation metrics: {error}",
        ) from error


@app.post("/code/map")
def code_map(request: CodeMapRequest) -> dict:
    started = time.perf_counter()
    try:
        repo = get_repo(request.repo_id)
        tree = file_tree(request.repo_id)
        file_list = [f.path for f in repo.files]
        result = generate_repo_map(request.repo_id, tree, file_list)
        duration_ms = int((time.perf_counter() - started) * 1000)
        log_run(
            "code_map",
            duration_ms,
            metadata={"repo_id": request.repo_id, "components": len(result.get("components") or [])},
        )
        return result
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AgentLLMError as error:
        message = str(error)
        status = 503 if "Ollama" in message else 500
        raise HTTPException(status_code=status, detail=message) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Repo map failed.") from error


@app.post("/code/analyze")
def code_analyze(request: CodeAnalyzeRequest) -> dict:
    started = time.perf_counter()
    try:
        content = read_file(request.repo_id, request.file)
        numbered = numbered_content(content)
        result = analyze_file(
            request.mode,
            request.file,
            numbered,
            request.question,
        )
        duration_ms = int((time.perf_counter() - started) * 1000)
        log_run(
            "code_analyze",
            duration_ms,
            metadata={
                "repo_id": request.repo_id,
                "file": request.file,
                "mode": request.mode,
            },
        )
        return result
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except AgentLLMError as error:
        message = str(error)
        status = 503 if "Ollama" in message else 500
        raise HTTPException(status_code=status, detail=message) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Code analysis failed.") from error
