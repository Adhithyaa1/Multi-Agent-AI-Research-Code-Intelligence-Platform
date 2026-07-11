"""Clone public GitHub repositories for code intelligence."""

from __future__ import annotations

import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from config import GITHUB_CLONE_DIR

GITHUB_URL_RE = re.compile(
    r"^(?:https?://)?(?:www\.)?github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?$",
    re.IGNORECASE,
)
GITHUB_SHORT_RE = re.compile(r"^([\w.-]+)/([\w.-]+)$")

_IS_WINDOWS = sys.platform == "win32"


def parse_github_url(url: str) -> tuple[str, str]:
    cleaned = url.strip().rstrip("/")

    match = GITHUB_URL_RE.match(cleaned)
    if match:
        return match.group(1), match.group(2)

    match = GITHUB_SHORT_RE.match(cleaned)
    if match:
        return match.group(1), match.group(2)

    raise ValueError(
        "Invalid GitHub URL. Use https://github.com/owner/repo or owner/repo"
    )


def _chmod_writable(func, path: str, exc_info) -> None:
    os.chmod(path, stat.S_IWRITE)
    func(path)


def _extended_path_string(path: Path) -> str:
    text = str(path.resolve())
    if not _IS_WINDOWS:
        return text
    if text.startswith("\\\\?\\"):
        return text
    if text.startswith("\\\\"):
        return "\\\\?\\UNC\\" + text[2:]
    return "\\\\?\\" + text


def _robocopy_remove(path: Path) -> None:
    empty = Path(tempfile.mkdtemp())
    try:
        subprocess.run(
            [
                "robocopy",
                str(empty),
                str(path),
                "/MIR",
                "/NFL",
                "/NDL",
                "/NJH",
                "/NJS",
                "/NP",
            ],
            capture_output=True,
            text=True,
            timeout=180,
        )
        if path.exists():
            os.rmdir(_extended_path_string(path))
    except OSError:
        pass
    finally:
        shutil.rmtree(empty, ignore_errors=True)


def _remove_directory_best_effort(path: Path) -> None:
    """Remove a directory when possible; never raise (handles Windows long paths)."""
    if not path.exists():
        return

    for attempt in range(2):
        try:
            shutil.rmtree(_extended_path_string(path), onerror=_chmod_writable)
            if not path.exists():
                return
        except OSError:
            time.sleep(0.2 * (attempt + 1))

    if _IS_WINDOWS and path.exists():
        _robocopy_remove(path)


def _git_base_args() -> list[str]:
    args = ["git"]
    if _IS_WINDOWS:
        args.extend(["-c", "core.longpaths=true"])
    return args


def _run_git(args: list[str], *, cwd: Path | None = None, timeout: int = 180) -> None:
    subprocess.run(
        _git_base_args() + args,
        check=True,
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=str(cwd) if cwd else None,
    )


def _has_checkout_content(path: Path) -> bool:
    if not path.exists():
        return False
    for child in path.iterdir():
        if child.name == ".git":
            continue
        return True
    return False


def _restore_checkout(path: Path) -> None:
    try:
        _run_git(["restore", "--source=HEAD", ":/"], cwd=path, timeout=120)
    except subprocess.CalledProcessError:
        pass


def _clone_into(clone_target: Path, clone_url: str) -> None:
    clone_target.parent.mkdir(parents=True, exist_ok=True)
    _run_git(
        ["clone", "--depth", "1", clone_url, str(clone_target)],
        timeout=180,
    )


def _cleanup_prior_imports(owner: str, repo: str) -> None:
    """Best-effort cleanup of older imports; failures are ignored."""
    if not GITHUB_CLONE_DIR.exists():
        return

    slug = f"{owner}-{repo}"
    for child in GITHUB_CLONE_DIR.iterdir():
        name = child.name
        if not child.is_dir():
            continue
        if name == slug or name.startswith(f"{slug}--") or name.startswith(f".{slug}"):
            _remove_directory_best_effort(child)


def clone_github_repo(url: str) -> tuple[Path, str]:
    owner, repo = parse_github_url(url)
    clone_url = f"https://github.com/{owner}/{repo}.git"
    slug = f"{owner}-{repo}"

    # Fresh path each import — never require deleting a deep Windows tree first.
    clone_target = (GITHUB_CLONE_DIR / f"{slug}--{int(time.time())}").resolve()
    _cleanup_prior_imports(owner, repo)

    clone_error: subprocess.CalledProcessError | None = None

    try:
        _clone_into(clone_target, clone_url)
    except FileNotFoundError as error:
        _remove_directory_best_effort(clone_target)
        raise RuntimeError(
            "git is not installed. Install Git to import GitHub repositories."
        ) from error
    except subprocess.CalledProcessError as error:
        clone_error = error
        message = (error.stderr or error.stdout or "").strip().lower()
        checkout_failed = "checkout failed" in message or "filename too long" in message

        if checkout_failed and _has_checkout_content(clone_target):
            _restore_checkout(clone_target)
        elif checkout_failed:
            _remove_directory_best_effort(clone_target)
            raise RuntimeError(
                "Git checkout failed: repository paths are too long for Windows. "
                "Enable long paths in Settings → System → For developers → "
                "Enable Win32 long paths, restart, and retry — or try a smaller repo."
            ) from error
        else:
            _remove_directory_best_effort(clone_target)
            raw = (error.stderr or error.stdout or "").strip()
            raise RuntimeError(f"Git clone failed: {raw or 'unknown error'}") from error
    except subprocess.TimeoutExpired as error:
        _remove_directory_best_effort(clone_target)
        raise RuntimeError("Git clone timed out after 3 minutes.") from error

    if clone_error and not _has_checkout_content(clone_target):
        _remove_directory_best_effort(clone_target)
        raw = (clone_error.stderr or clone_error.stdout or "").strip()
        raise RuntimeError(
            f"Git clone failed: {raw or 'checkout produced no files'}"
        ) from clone_error

    return clone_target, f"{owner}/{repo}"
