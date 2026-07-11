"""Writer agent: produce the final report from all prior agent outputs."""

from __future__ import annotations

from agents.llm import AgentLLMError, call_ollama, compact_agent_output, parse_writer_response

# Writer needs more tokens than other agents (full report in JSON).
WRITER_NUM_PREDICT = 768

SYSTEM_PROMPT = """You are a writer agent.

Produce a clear final research report from the planner, researcher, coder,
and critic outputs.

Respond with ONLY valid JSON (no markdown fences):
{
  "title": "short report title",
  "report": "markdown report, max 400 words",
  "summary": "2 sentence executive summary"
}

Use these sections in the report string:
## Overview
## Key Concepts
## Evidence
## Architecture
## Limitations
## Conclusion

Rules:
- Keep the report under 400 words so JSON stays valid.
- Escape newlines in the report string as \\n.
- Incorporate critic caveats.
- Do not invent unsupported claims.
"""


def run_writer(
    question: str,
    tasks: list[str],
    research_notes: dict,
    code_analysis: dict,
    critique: dict,
) -> dict:
    cleaned = question.strip()
    if not cleaned:
        raise AgentLLMError("Question must not be empty.")

    task_block = "\n".join(f"- {task}" for task in tasks[:5])
    user_prompt = (
        f"Question:\n{cleaned}\n\n"
        f"Plan tasks:\n{task_block}\n\n"
        f"Research notes:\n{compact_agent_output(research_notes)}\n\n"
        f"Code analysis:\n{compact_agent_output(code_analysis)}\n\n"
        f"Critique:\n{compact_agent_output(critique)}\n"
    )

    raw = call_ollama(
        SYSTEM_PROMPT,
        user_prompt,
        num_predict=WRITER_NUM_PREDICT,
    )
    return parse_writer_response(raw)
