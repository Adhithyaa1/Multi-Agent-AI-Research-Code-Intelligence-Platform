"""Week 5 code intelligence: repo map, explain, bugs, improvements."""

from __future__ import annotations

from agents.llm import (
    AgentLLMError,
    as_string_list,
    call_ollama,
    extract_json_object,
)

MAP_NUM_PREDICT = 512
ANALYZE_NUM_PREDICT = 640

MAP_PROMPT = """You are a code intelligence agent.

Given a project file tree, produce a repository map grouping files into logical components.

Respond with ONLY valid JSON:
{
  "project_name": "name",
  "components": [
    {
      "name": "Data Pipeline",
      "files": ["data/load.py"],
      "description": "what this area does"
    }
  ],
  "summary": "one paragraph overview"
}

Rules:
- Group related files into 3–6 components.
- Every listed file must appear in the tree.
- Keep descriptions concise.
"""

EXPLAIN_PROMPT = """You are a code intelligence agent.

Explain the given source file clearly for a developer.

Respond with ONLY valid JSON:
{
  "summary": "2–3 sentence overview",
  "key_elements": ["classes, functions, or modules and what they do"],
  "data_flow": "how data moves through this file",
  "dependencies": ["important imports or couplings"]
}
"""

BUGS_PROMPT = """You are a code review agent.

Find potential bugs, missing error handling, or logic issues in the file.
Reference line numbers from the numbered source when possible.

Respond with ONLY valid JSON:
{
  "issues": [
    {
      "line": 42,
      "severity": "high|medium|low",
      "description": "what the issue is",
      "suggestion": "how to fix"
    }
  ],
  "summary": "overall assessment"
}

Rules:
- Only flag plausible issues supported by the code shown.
- If no issues found, return an empty issues array and say so in summary.
"""

IMPROVE_PROMPT = """You are a senior engineer suggesting improvements.

Suggest concrete, actionable improvements for the file.

Respond with ONLY valid JSON:
{
  "suggestions": [
    {
      "title": "short title",
      "description": "what to change and why",
      "impact": "expected benefit"
    }
  ],
  "summary": "overall improvement theme"
}

Rules:
- 2–5 suggestions, prioritized by impact.
- Be specific (e.g. replace X with Y), not generic advice.
"""


def generate_repo_map(repo_id: str, tree: str, file_list: list[str]) -> dict:
    user_prompt = (
        f"Repository file tree:\n{tree}\n\n"
        f"All files:\n" + "\n".join(f"- {f}" for f in file_list)
    )
    raw = call_ollama(MAP_PROMPT, user_prompt, num_predict=MAP_NUM_PREDICT)
    payload = extract_json_object(raw)

    components = payload.get("components") or []
    if not isinstance(components, list):
        components = []

    return {
        "repo_id": repo_id,
        "project_name": str(payload.get("project_name") or "Project").strip(),
        "components": components,
        "summary": str(payload.get("summary") or "").strip(),
    }


def analyze_file(
    mode: str,
    file_path: str,
    numbered_source: str,
    question: str | None = None,
) -> dict:
    if mode == "explain":
        system = EXPLAIN_PROMPT
    elif mode == "bugs":
        system = BUGS_PROMPT
    elif mode == "improve":
        system = IMPROVE_PROMPT
    else:
        raise AgentLLMError(f"Unknown analysis mode: {mode}")

    user_prompt = f"File: {file_path}\n\nNumbered source:\n{numbered_source}\n"
    if question:
        user_prompt += f"\nUser question: {question}\n"

    raw = call_ollama(system, user_prompt, num_predict=ANALYZE_NUM_PREDICT)

    try:
        payload = extract_json_object(raw)
    except AgentLLMError:
        return {
            "mode": mode,
            "file": file_path,
            "summary": raw[:600],
            "raw": raw,
        }

    result = {
        "mode": mode,
        "file": file_path,
        "summary": str(payload.get("summary") or "").strip(),
    }

    if mode == "explain":
        result["key_elements"] = as_string_list(payload.get("key_elements"))
        result["data_flow"] = str(payload.get("data_flow") or "").strip()
        result["dependencies"] = as_string_list(payload.get("dependencies"))
    elif mode == "bugs":
        result["issues"] = payload.get("issues") or []
    elif mode == "improve":
        result["suggestions"] = payload.get("suggestions") or []

    return result


ASK_PROMPT = """You are a code intelligence agent answering questions about a codebase.

Use ONLY the retrieved code snippets below. Cite file paths when relevant.
If the answer is not supported by the snippets, say so clearly.

Respond with ONLY valid JSON:
{
  "answer": "detailed answer referencing files and logic",
  "sources": ["path/to/file.py"],
  "confidence": "high|medium|low",
  "limitations": "what could not be determined from the retrieved context"
}
"""


def ask_repo(question: str, chunks: list[dict]) -> dict:
    if not chunks:
        raise AgentLLMError("No indexed code found. Index the repository first.")

    context_parts: list[str] = []
    for chunk in chunks:
        metadata = chunk.get("metadata") or {}
        file_path = metadata.get("file_path", "?")
        start_line = metadata.get("start_line", "?")
        score = chunk.get("score")
        header = f"--- {file_path} (line {start_line}"
        if score is not None:
            header += f", relevance {score}"
        header += ") ---"
        context_parts.append(f"{header}\n{chunk.get('text', '')}")

    user_prompt = (
        f"Question: {question}\n\nRetrieved code snippets:\n"
        + "\n\n".join(context_parts)
    )

    raw = call_ollama(ASK_PROMPT, user_prompt, num_predict=ANALYZE_NUM_PREDICT)

    try:
        payload = extract_json_object(raw)
    except AgentLLMError:
        return {
            "question": question,
            "answer": raw[:800],
            "sources": [],
            "confidence": "low",
            "limitations": "Response was not valid JSON.",
            "retrieved_chunks": len(chunks),
        }

    return {
        "question": question,
        "answer": str(payload.get("answer") or "").strip(),
        "sources": as_string_list(payload.get("sources")),
        "confidence": str(payload.get("confidence") or "medium").strip(),
        "limitations": str(payload.get("limitations") or "").strip(),
        "retrieved_chunks": len(chunks),
    }
