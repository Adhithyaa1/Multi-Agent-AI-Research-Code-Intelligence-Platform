"""Coder agent: architecture / implementation-oriented analysis."""

from __future__ import annotations

from agents.llm import (
    AgentLLMError,
    as_string_list,
    call_ollama,
    extract_json_object,
    format_context,
)

SYSTEM_PROMPT = """You are a code intelligence agent.

Analyze the question from a software/architecture perspective.
If no repository is provided, reason about typical architecture, components,
interfaces, and implementation risks for the topic.

Respond with ONLY valid JSON:
{
  "architecture": ["...", "..."],
  "components": ["...", "..."],
  "implementation_notes": ["...", "..."],
  "risks": ["...", "..."],
  "summary": "one short paragraph"
}

Rules:
- Prefer concrete, technical bullets.
- If document context is provided, use it.
- Do not invent specific file paths unless they appear in context.
"""


def run_coder(
    question: str,
    research_notes: dict,
    context_chunks: list[str] | None = None,
) -> dict:
    cleaned = question.strip()
    if not cleaned:
        raise AgentLLMError("Question must not be empty.")

    research_summary = research_notes.get("summary") or ""
    concepts = ", ".join(research_notes.get("important_concepts") or [])
    context_block = format_context(context_chunks)

    user_prompt = (
        f"Question:\n{cleaned}\n\n"
        f"Research summary:\n{research_summary}\n\n"
        f"Key concepts:\n{concepts}\n"
    )
    if context_block:
        user_prompt += f"\nDocument context:\n{context_block}\n"

    raw = call_ollama(SYSTEM_PROMPT, user_prompt)
    payload = extract_json_object(raw)

    analysis = {
        "architecture": as_string_list(payload.get("architecture")),
        "components": as_string_list(payload.get("components")),
        "implementation_notes": as_string_list(payload.get("implementation_notes")),
        "risks": as_string_list(payload.get("risks")),
        "summary": str(payload.get("summary") or "").strip(),
    }

    if not any(analysis.values()):
        raise AgentLLMError("Coder returned empty analysis.")

    return analysis
