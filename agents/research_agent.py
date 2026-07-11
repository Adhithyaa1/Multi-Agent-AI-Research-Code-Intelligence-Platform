"""Week 3 research agent: question → structured research notes via local Ollama."""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")

SYSTEM_PROMPT = """You are a research assistant.

Given a research question, produce structured research notes.

Find and report:
- important concepts
- evidence
- limitations
- future work

Respond with ONLY valid JSON in this exact shape:
{
  "important_concepts": ["...", "..."],
  "evidence": ["...", "..."],
  "limitations": ["...", "..."],
  "future_work": ["...", "..."],
  "summary": "one short paragraph overview"
}

Rules:
- Each list should have 2–6 concise bullet-style strings.
- If document context is provided, ground your notes in that context and do not invent unsupported facts.
- If context is missing or insufficient for a section, say so briefly in that section.
"""


@dataclass
class ResearchNotes:
    question: str
    important_concepts: list[str] = field(default_factory=list)
    evidence: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)
    future_work: list[str] = field(default_factory=list)
    summary: str = ""
    grounded_in_document: bool = False
    document_id: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


class ResearchAgentError(Exception):
    """Raised when the research agent cannot complete a run."""


def _build_user_prompt(question: str, context_chunks: list[str] | None) -> str:
    if not context_chunks:
        return f"Research question:\n{question}"

    context = "\n\n".join(
        f"[{index + 1}] {chunk}" for index, chunk in enumerate(context_chunks)
    )
    return (
        f"Research question:\n{question}\n\n"
        f"Document context (use this as primary evidence):\n{context}"
    )


def _call_ollama(question: str, context_chunks: list[str] | None) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": "json",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": _build_user_prompt(question, context_chunks),
            },
        ],
    }

    request = urllib.request.Request(
        f"{OLLAMA_BASE_URL}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as error:
        raise ResearchAgentError(
            "Ollama is not running. Start it and ensure llama3.1 is available."
        ) from error

    message = body.get("message") or {}
    content = message.get("content")
    if not content or not str(content).strip():
        raise ResearchAgentError("Ollama returned an empty response.")

    return str(content).strip()


def _as_string_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _extract_json_object(raw: str) -> dict:
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
    if not match:
        raise ResearchAgentError("Could not parse research notes as JSON.")

    parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ResearchAgentError("Research notes JSON must be an object.")

    return parsed


def _notes_from_payload(
    question: str,
    payload: dict,
    *,
    document_id: str | None,
    grounded: bool,
) -> ResearchNotes:
    return ResearchNotes(
        question=question,
        important_concepts=_as_string_list(payload.get("important_concepts")),
        evidence=_as_string_list(payload.get("evidence")),
        limitations=_as_string_list(payload.get("limitations")),
        future_work=_as_string_list(payload.get("future_work")),
        summary=str(payload.get("summary") or "").strip(),
        grounded_in_document=grounded,
        document_id=document_id,
    )


def run_research(
    question: str,
    *,
    context_chunks: list[str] | None = None,
    document_id: str | None = None,
) -> ResearchNotes:
    """Run the research agent and return structured notes."""
    cleaned = question.strip()
    if not cleaned:
        raise ResearchAgentError("Question must not be empty.")

    chunks = [chunk.strip() for chunk in (context_chunks or []) if chunk.strip()]
    grounded = bool(chunks)

    raw = _call_ollama(cleaned, chunks or None)
    payload = _extract_json_object(raw)
    notes = _notes_from_payload(
        cleaned,
        payload,
        document_id=document_id,
        grounded=grounded,
    )

    if not any(
        [
            notes.important_concepts,
            notes.evidence,
            notes.limitations,
            notes.future_work,
            notes.summary,
        ]
    ):
        raise ResearchAgentError("Research notes were empty after parsing.")

    return notes


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Run the Week 3 research agent.")
    parser.add_argument("question", help="Research question to analyze")
    args = parser.parse_args()

    notes = run_research(args.question)
    print(json.dumps(notes.to_dict(), indent=2))


if __name__ == "__main__":
    main()
