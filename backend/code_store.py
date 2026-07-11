"""Store and load uploaded code repositories."""

from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path

from config import CODE_EXTENSIONS, CODE_REPOS_DIR, MAX_CODE_FILE_BYTES, MAX_CODE_FILES

REGISTRY_PATH = CODE_REPOS_DIR / "_registry.json"


@dataclass
class CodeFileInfo:
    path: str
    size: int


@dataclass
class CodeRepo:
    repo_id: str
    name: str
    root_path: str
    files: list[CodeFileInfo]


def _load_registry() -> dict:
    if not REGISTRY_PATH.exists():
        return {}
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


def _save_registry(registry: dict) -> None:
    CODE_REPOS_DIR.mkdir(parents=True, exist_ok=True)
    REGISTRY_PATH.write_text(json.dumps(registry, indent=2), encoding="utf-8")


def register_repo(root_path: str, name: str | None = None) -> CodeRepo:
    root = Path(root_path).resolve()
    if not root.exists():
        raise FileNotFoundError(f"Repository path not found: {root}")

    files: list[CodeFileInfo] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in CODE_EXTENSIONS:
            continue
        if any(part.startswith(".") for part in path.relative_to(root).parts):
            continue
        if len(files) >= MAX_CODE_FILES:
            break
        rel = path.relative_to(root).as_posix()
        files.append(CodeFileInfo(path=rel, size=path.stat().st_size))

    if not files:
        raise ValueError("No supported code files found in the repository.")

    repo_id = str(uuid.uuid4())
    repo_name = name or root.name

    registry = _load_registry()
    registry[repo_id] = {
        "repo_id": repo_id,
        "name": repo_name,
        "root_path": str(root),
        "files": [asdict(f) for f in files],
    }
    _save_registry(registry)

    return CodeRepo(repo_id=repo_id, name=repo_name, root_path=str(root), files=files)


def get_repo(repo_id: str) -> CodeRepo:
    registry = _load_registry()
    entry = registry.get(repo_id)
    if not entry:
        raise KeyError(f"Repository not found: {repo_id}")

    return CodeRepo(
        repo_id=entry["repo_id"],
        name=entry["name"],
        root_path=entry["root_path"],
        files=[CodeFileInfo(**f) for f in entry["files"]],
    )


def read_file(repo_id: str, file_path: str) -> str:
    repo = get_repo(repo_id)
    root = Path(repo.root_path)
    target = (root / file_path).resolve()

    if not str(target).startswith(str(root.resolve())):
        raise ValueError("Invalid file path.")

    if not target.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    content = target.read_text(encoding="utf-8", errors="ignore")
    if len(content.encode("utf-8")) > MAX_CODE_FILE_BYTES:
        content = content[:MAX_CODE_FILE_BYTES] + "\n\n# ... truncated ..."
    return content


def file_tree(repo_id: str) -> str:
    repo = get_repo(repo_id)
    lines = [repo.name + "/"]
    for info in repo.files:
        lines.append(f"  {info.path}")
    return "\n".join(lines)


def numbered_content(content: str) -> str:
    return "\n".join(
        f"{index + 1:4d}| {line}"
        for index, line in enumerate(content.splitlines())
    )
