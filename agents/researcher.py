"""Researcher agent: collect structured research notes for planned tasks."""

from __future__ import annotations

from agents.llm import (
    AgentLLMError,
    as_string_list,
    call_ollama,
    extract_json_object,
    format_context,
)

SYSTEM_PROMPT = """You are a research agent.

Given a question and a task plan, collect research notes.

Find and report:
- important concepts
- evidence
- limitations
- future work

Respond with ONLY valid JSON:
{
  "important_concepts": ["...", "..."],
  "evidence": ["...", "..."],
  "limitations": ["...", "..."],
  "future_work": ["...", "..."],
  "summary": "one short paragraph overview"
}

Rules:
- Each list should have 2–4 concise bullet-style strings.
- If document context is provided, ground notes in that context.
- If context is insufficient for a section, say so briefly.
"""


def run_researcher(
    question: str,
    tasks: list[str],
    context_chunks: list[str] | None = None,
) -> dict:
    cleaned = question.strip()
    if not cleaned:
        raise AgentLLMError("Question must not be empty.")

    task_block = "\n".join(f"- {task}" for task in tasks) or "- Investigate the question"
    context_block = format_context(context_chunks)
    user_prompt = (
        f"Question:\n{cleaned}\n\n"
        f"Task plan:\n{task_block}\n"
    )
    if context_block:
        user_prompt += f"\nDocument context:\n{context_block}\n"

    raw = call_ollama(SYSTEM_PROMPT, user_prompt)
    payload = extract_json_object(raw)

    notes = {
        "important_concepts": as_string_list(payload.get("important_concepts")),
        "evidence": as_string_list(payload.get("evidence")),
        "limitations": as_string_list(payload.get("limitations")),
        "future_work": as_string_list(payload.get("future_work")),
        "summary": str(payload.get("summary") or "").strip(),
    }

    if not any(notes.values()):
        raise AgentLLMError("Researcher returned empty notes.")

    return notes
