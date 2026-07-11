"""Persist evaluation metrics for pipeline and code intelligence runs."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from config import BACKEND_DIR

EVAL_PATH = BACKEND_DIR / "data" / "eval_runs.json"
MAX_RUNS = 200

CONFIDENCE_SCORES = {
    "low": 0.33,
    "medium": 0.66,
    "high": 1.0,
}


def _confidence_score(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().lower()
        if cleaned in CONFIDENCE_SCORES:
            return CONFIDENCE_SCORES[cleaned]
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _load_runs() -> list[dict]:
    if not EVAL_PATH.exists():
        return []
    try:
        data = json.loads(EVAL_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []


def _save_runs(runs: list[dict]) -> None:
    EVAL_PATH.parent.mkdir(parents=True, exist_ok=True)
    EVAL_PATH.write_text(json.dumps(runs[-MAX_RUNS:], indent=2), encoding="utf-8")


def log_run(
    run_type: str,
    duration_ms: int,
    *,
    success: bool = True,
    metadata: dict | None = None,
) -> dict:
    entry = {
        "id": str(uuid.uuid4()),
        "type": run_type,
        "duration_ms": duration_ms,
        "success": success,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {},
    }

    runs = _load_runs()
    runs.append(entry)
    _save_runs(runs)
    return entry


def get_metrics() -> dict:
    runs = _load_runs()
    if not runs:
        return {
            "total_runs": 0,
            "recent_runs": [],
            "by_type": {},
            "avg_duration_ms": 0,
        }

    by_type: dict[str, list[int]] = {}
    for run in runs:
        run_type = run.get("type", "unknown")
        by_type.setdefault(run_type, []).append(run.get("duration_ms", 0))

    type_stats = {
        name: {
            "count": len(durations),
            "avg_duration_ms": int(sum(durations) / len(durations)),
        }
        for name, durations in by_type.items()
    }

    all_durations = [run.get("duration_ms", 0) for run in runs]
    critic_scores = [
        score
        for run in runs
        if run.get("type") == "pipeline"
        for score in [_confidence_score(run.get("metadata", {}).get("critic_confidence"))]
        if score is not None
    ]

    return {
        "total_runs": len(runs),
        "recent_runs": list(reversed(runs[-20:])),
        "by_type": type_stats,
        "avg_duration_ms": int(sum(all_durations) / len(all_durations)),
        "critic_confidence_avg": (
            round(sum(critic_scores) / len(critic_scores), 2)
            if critic_scores
            else None
        ),
    }
