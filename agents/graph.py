"""LangGraph multi-agent pipeline: planner → researcher → coder → critic → writer."""

from __future__ import annotations

import time
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from agents.coder import run_coder
from agents.critic import run_critic
from agents.llm import AgentLLMError
from agents.planner import run_planner
from agents.researcher import run_researcher
from agents.writer import run_writer


class TraceStep(TypedDict):
    agent: str
    status: str
    summary: str
    duration_ms: int


class PipelineState(TypedDict, total=False):
    question: str
    document_id: str | None
    context_chunks: list[str]
    tasks: list[str]
    plan_summary: str
    research_notes: dict
    code_analysis: dict
    critique: dict
    final_report: dict
    trace: list[TraceStep]
    error: str


def _append_trace(
    state: PipelineState,
    agent: str,
    summary: str,
    duration_ms: int,
    status: str = "ok",
) -> list[TraceStep]:
    trace = list(state.get("trace") or [])
    trace.append(
        {
            "agent": agent,
            "status": status,
            "summary": summary,
            "duration_ms": duration_ms,
        }
    )
    return trace


def planner_node(state: PipelineState) -> PipelineState:
    started = time.perf_counter()
    result = run_planner(state["question"])
    duration_ms = int((time.perf_counter() - started) * 1000)
    summary = result.get("summary") or f"Planned {len(result['tasks'])} tasks"
    return {
        "tasks": result["tasks"],
        "plan_summary": summary,
        "trace": _append_trace(state, "planner", summary, duration_ms),
    }


def researcher_node(state: PipelineState) -> PipelineState:
    started = time.perf_counter()
    notes = run_researcher(
        state["question"],
        state.get("tasks") or [],
        state.get("context_chunks"),
    )
    duration_ms = int((time.perf_counter() - started) * 1000)
    summary = notes.get("summary") or "Collected research notes"
    return {
        "research_notes": notes,
        "trace": _append_trace(state, "researcher", summary, duration_ms),
    }


def coder_node(state: PipelineState) -> PipelineState:
    started = time.perf_counter()
    analysis = run_coder(
        state["question"],
        state.get("research_notes") or {},
        state.get("context_chunks"),
    )
    duration_ms = int((time.perf_counter() - started) * 1000)
    summary = analysis.get("summary") or "Completed architecture analysis"
    return {
        "code_analysis": analysis,
        "trace": _append_trace(state, "coder", summary, duration_ms),
    }


def critic_node(state: PipelineState) -> PipelineState:
    started = time.perf_counter()
    critique = run_critic(
        state["question"],
        state.get("research_notes") or {},
        state.get("code_analysis") or {},
        state.get("context_chunks"),
    )
    duration_ms = int((time.perf_counter() - started) * 1000)
    summary = critique.get("summary") or f"Confidence: {critique.get('confidence')}"
    return {
        "critique": critique,
        "trace": _append_trace(state, "critic", summary, duration_ms),
    }


def writer_node(state: PipelineState) -> PipelineState:
    started = time.perf_counter()
    report = run_writer(
        state["question"],
        state.get("tasks") or [],
        state.get("research_notes") or {},
        state.get("code_analysis") or {},
        state.get("critique") or {},
    )
    duration_ms = int((time.perf_counter() - started) * 1000)
    summary = report.get("summary") or report.get("title") or "Wrote final report"
    return {
        "final_report": report,
        "trace": _append_trace(state, "writer", summary, duration_ms),
    }


def build_pipeline():
    graph = StateGraph(PipelineState)
    graph.add_node("planner", planner_node)
    graph.add_node("researcher", researcher_node)
    graph.add_node("coder", coder_node)
    graph.add_node("critic", critic_node)
    graph.add_node("writer", writer_node)

    graph.add_edge(START, "planner")
    graph.add_edge("planner", "researcher")
    graph.add_edge("researcher", "coder")
    graph.add_edge("coder", "critic")
    graph.add_edge("critic", "writer")
    graph.add_edge("writer", END)

    return graph.compile()


_PIPELINE = None


def get_pipeline():
    global _PIPELINE
    if _PIPELINE is None:
        _PIPELINE = build_pipeline()
    return _PIPELINE


def _build_result(final_state: PipelineState, *, document_id: str | None, context_chunks: list[str] | None) -> dict:
    report = final_state.get("final_report") or {}
    cleaned = final_state.get("question") or ""
    return {
        "question": cleaned,
        "document_id": document_id,
        "grounded_in_document": bool(context_chunks),
        "tasks": final_state.get("tasks") or [],
        "plan_summary": final_state.get("plan_summary") or "",
        "research_notes": final_state.get("research_notes") or {},
        "code_analysis": final_state.get("code_analysis") or {},
        "critique": final_state.get("critique") or {},
        "final_report": report,
        "trace": final_state.get("trace") or [],
    }


def run_pipeline(
    question: str,
    *,
    context_chunks: list[str] | None = None,
    document_id: str | None = None,
) -> dict:
    cleaned = question.strip()
    if not cleaned:
        raise AgentLLMError("Question must not be empty.")

    initial: PipelineState = {
        "question": cleaned,
        "document_id": document_id,
        "context_chunks": context_chunks or [],
        "trace": [],
    }

    try:
        final_state = get_pipeline().invoke(initial)
    except AgentLLMError:
        raise
    except Exception as error:
        raise AgentLLMError(f"Multi-agent pipeline failed: {error}") from error

    return _build_result(final_state, document_id=document_id, context_chunks=context_chunks)


def run_pipeline_stream(
    question: str,
    *,
    context_chunks: list[str] | None = None,
    document_id: str | None = None,
):
    """Yield SSE-friendly events as each agent completes."""
    cleaned = question.strip()
    if not cleaned:
        raise AgentLLMError("Question must not be empty.")

    initial: PipelineState = {
        "question": cleaned,
        "document_id": document_id,
        "context_chunks": context_chunks or [],
        "trace": [],
    }

    accumulated: PipelineState = dict(initial)

    try:
        for chunk in get_pipeline().stream(initial, stream_mode="updates"):
            for _node_name, node_update in chunk.items():
                accumulated.update(node_update)
                trace = node_update.get("trace") or []
                if trace:
                    yield {"type": "step", "step": trace[-1]}

        yield {
            "type": "done",
            "result": _build_result(
                accumulated,
                document_id=document_id,
                context_chunks=context_chunks,
            ),
        }
    except AgentLLMError:
        raise
    except Exception as error:
        raise AgentLLMError(f"Multi-agent pipeline failed: {error}") from error


def main() -> None:
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Run the Week 4 multi-agent pipeline.")
    parser.add_argument("question", help="Research question to analyze")
    args = parser.parse_args()

    result = run_pipeline(args.question)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
