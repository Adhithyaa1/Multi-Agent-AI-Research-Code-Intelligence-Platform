"""Shared Ollama helpers for Week 3–4 agents."""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")


class AgentLLMError(Exception):
    """Raised when an agent cannot reach or parse the LLM."""


# Cap output length so five sequential agents finish within a reasonable time on CPU.
OLLAMA_NUM_PREDICT = int(os.environ.get("OLLAMA_NUM_PREDICT", "384"))


def call_ollama(
    system_prompt: str,
    user_prompt: str,
    *,
    as_json: bool = True,
    timeout: int = 300,
    num_predict: int | None = None,
) -> str:
    payload: dict = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "options": {
            "num_predict": num_predict if num_predict is not None else OLLAMA_NUM_PREDICT,
            "temperature": 0.3,
        },
    }
    if as_json:
        payload["format"] = "json"

    request = urllib.request.Request(
        f"{OLLAMA_BASE_URL}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as error:
        raise AgentLLMError(
            "Ollama is not running. Start it and ensure llama3.1 is available."
        ) from error

    message = body.get("message") or {}
    content = message.get("content")
    if not content or not str(content).strip():
        raise AgentLLMError("Ollama returned an empty response.")

    return str(content).strip()


def _strip_code_fences(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def extract_json_object(raw: str) -> dict:
    text = _strip_code_fences(raw)

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    raise AgentLLMError("Could not parse agent response as JSON.")


def parse_writer_response(raw: str) -> dict:
    """Parse writer output; fall back to plain markdown if JSON is truncated."""
    text = _strip_code_fences(raw)

    try:
        payload = extract_json_object(text)
    except AgentLLMError:
        if len(text) < 40:
            raise
        return {
            "title": "Research Report",
            "report": text,
            "summary": text[:280].strip() + ("…" if len(text) > 280 else ""),
        }

    report = str(payload.get("report") or "").strip()
    title = str(payload.get("title") or "Research Report").strip()
    summary = str(payload.get("summary") or "").strip()

    if not report and text:
        report = text
    if not summary and report:
        summary = report[:280].strip() + ("…" if len(report) > 280 else "")

    if not report:
        raise AgentLLMError("Writer returned an empty report.")

    return {"title": title, "report": report, "summary": summary}


def as_string_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def format_context(context_chunks: list[str] | None, *, max_chunks: int = 3) -> str:
    if not context_chunks:
        return ""
    trimmed = [chunk[:800] for chunk in context_chunks[:max_chunks]]
    return "\n\n".join(
        f"[{index + 1}] {chunk}" for index, chunk in enumerate(trimmed)
    )


def compact_agent_output(notes: dict, *, max_items: int = 3) -> str:
    """Shrink prior agent output for downstream prompts (faster, fewer tokens)."""
    parts: list[str] = []
    summary = str(notes.get("summary") or "").strip()
    if summary:
        parts.append(f"Summary: {summary[:500]}")

    for key in (
        "important_concepts",
        "evidence",
        "limitations",
        "future_work",
        "architecture",
        "components",
        "implementation_notes",
        "risks",
        "supported",
        "issues",
        "revisions",
    ):
        items = as_string_list(notes.get(key))
        if items:
            label = key.replace("_", " ").title()
            parts.append(f"{label}: " + "; ".join(items[:max_items]))

    return "\n".join(parts) if parts else str(notes)[:1200]
