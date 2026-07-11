"""Planner agent: break a research question into ordered tasks."""

from __future__ import annotations

from agents.llm import AgentLLMError, as_string_list, call_ollama, extract_json_object

SYSTEM_PROMPT = """You are a planning agent for a research team.

Break the user's question into exactly 3 concrete, ordered research tasks.

Respond with ONLY valid JSON:
{
  "tasks": ["Task 1: ...", "Task 2: ..."],
  "summary": "one sentence plan overview"
}
"""


def run_planner(question: str) -> dict:
    cleaned = question.strip()
    if not cleaned:
        raise AgentLLMError("Question must not be empty.")

    raw = call_ollama(SYSTEM_PROMPT, f"Question:\n{cleaned}")
    payload = extract_json_object(raw)
    tasks = as_string_list(payload.get("tasks"))

    if not tasks:
        raise AgentLLMError("Planner returned no tasks.")

    return {
        "tasks": tasks,
        "summary": str(payload.get("summary") or "").strip(),
    }
