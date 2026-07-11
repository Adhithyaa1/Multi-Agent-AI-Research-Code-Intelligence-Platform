import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent
CHROMA_DIR = BACKEND_DIR / "data" / "chroma"
COLLECTION_NAME = "documents"

EMBEDDING_MODEL = "all-MiniLM-L6-v2"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
DEFAULT_TOP_K = 4

SUPPORTED_EXTENSIONS = {".pdf", ".md", ".txt"}

CODE_REPOS_DIR = Path(
    os.environ.get(
        "CODE_REPOS_DIR",
        str(REPO_ROOT / "research-agent" / "uploads" / "code"),
    )
)

# Shorter path for git clones (avoids Windows MAX_PATH issues on deep repos).
GITHUB_CLONE_DIR = Path(
    os.environ.get(
        "GITHUB_CLONE_DIR",
        str(BACKEND_DIR / "data" / "gh"),
    )
)

CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".md", ".txt", ".json",
    ".yaml", ".yml", ".rs", ".go", ".java", ".cpp", ".c", ".h", ".cs",
}

MAX_CODE_FILE_BYTES = 80_000
MAX_CODE_FILES = 40
CODE_CHUNK_SIZE = 1200
CODE_CHUNK_OVERLAP = 200

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")
RESEARCH_TOP_K = 6

CORS_ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:3000",
    ).split(",")
    if origin.strip()
]
