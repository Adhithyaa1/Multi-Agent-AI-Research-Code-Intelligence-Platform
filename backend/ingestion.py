from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader

from config import CHUNK_OVERLAP, CHUNK_SIZE, SUPPORTED_EXTENSIONS


@dataclass
class DocumentChunk:
    text: str
    chunk_index: int
    source: str


def load_document_text(file_path: Path) -> str:
    suffix = file_path.suffix.lower()

    if suffix not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {suffix}")

    if suffix == ".pdf":
        reader = PdfReader(str(file_path))
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages).strip()
    else:
        text = file_path.read_text(encoding="utf-8", errors="ignore").strip()

    if not text:
        raise ValueError("Document is empty or text could not be extracted.")

    return text


def chunk_text(text: str, source: str) -> list[DocumentChunk]:
    chunks: list[DocumentChunk] = []
    start = 0
    chunk_index = 0

    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        piece = text[start:end].strip()

        if piece:
            chunks.append(
                DocumentChunk(
                    text=piece,
                    chunk_index=chunk_index,
                    source=source,
                )
            )
            chunk_index += 1

        if end >= len(text):
            break

        start = max(end - CHUNK_OVERLAP, start + 1)

    return chunks


def ingest_file(file_path: str) -> tuple[str, list[DocumentChunk]]:
    path = Path(file_path).resolve()

    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    text = load_document_text(path)
    chunks = chunk_text(text, source=path.name)

    if not chunks:
        raise ValueError("No chunks were produced from the document.")

    return path.name, chunks
