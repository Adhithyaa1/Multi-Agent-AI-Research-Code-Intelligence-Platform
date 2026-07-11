"""Critic agent: check support and possible hallucinations."""

from __future__ import annotations

from agents.llm import (
    AgentLLMError,
    as_string_list,
    call_ollama,
    compact_agent_output,
    extract_json_object,
    format_context,
)

SYSTEM_PROMPT = """You are a critic agent.

Review research and code notes for unsupported claims and hallucinations.

Respond with ONLY valid JSON:
{
  "supported": ["claims that appear well supported"],
  "issues": ["potential hallucinations or weak claims"],
  "revisions": ["suggested fixes or caveats"],
  "confidence": "low|medium|high",
  "summary": "one short paragraph"
}

Rules:
- Be skeptical but fair.
- If document context is provided, treat it as primary evidence.
- Flag claims that go beyond the available notes/context.
"""


def run_critic(
    question: str,
    research_notes: dict,
    code_analysis: dict,
    context_chunks: list[str] | None = None,
) -> dict:
    cleaned = question.strip()
    if not cleaned:
        raise AgentLLMError("Question must not be empty.")

    context_block = format_context(context_chunks)
    user_prompt = (
        f"Question:\n{cleaned}\n\n"
        f"Research notes:\n{compact_agent_output(research_notes)}\n\n"
        f"Code analysis:\n{compact_agent_output(code_analysis)}\n"
    )
    if context_block:
        user_prompt += f"\nDocument context:\n{context_block}\n"

    raw = call_ollama(SYSTEM_PROMPT, user_prompt)
    payload = extract_json_object(raw)

    confidence = str(payload.get("confidence") or "medium").strip().lower()
    if confidence not in {"low", "medium", "high"}:
        confidence = "medium"

    critique = {
        "supported": as_string_list(payload.get("supported")),
        "issues": as_string_list(payload.get("issues")),
        "revisions": as_string_list(payload.get("revisions")),
        "confidence": confidence,
        "summary": str(payload.get("summary") or "").strip(),
    }

    if not any(
        [
            critique["supported"],
            critique["issues"],
            critique["revisions"],
            critique["summary"],
        ]
    ):
        raise AgentLLMError("Critic returned empty review.")

    return critique
