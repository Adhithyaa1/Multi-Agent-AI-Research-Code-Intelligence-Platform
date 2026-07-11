"""Index code repositories in ChromaDB for semantic Q&A."""

from __future__ import annotations

from dataclasses import dataclass

import chromadb
from sentence_transformers import SentenceTransformer

from code_store import get_repo, read_file
from config import CHROMA_DIR, CODE_CHUNK_SIZE, CODE_CHUNK_OVERLAP, EMBEDDING_MODEL

CODE_COLLECTION = "code_repos"

_model: SentenceTransformer | None = None
_client: chromadb.PersistentClient | None = None


@dataclass
class CodeChunk:
    text: str
    file_path: str
    chunk_index: int
    start_line: int


def get_code_collection():
    global _client
    if _client is None:
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))

    return _client.get_or_create_collection(
        name=CODE_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def chunk_file_content(file_path: str, content: str) -> list[CodeChunk]:
    lines = content.splitlines()
    chunks: list[CodeChunk] = []
    buffer: list[str] = []
    buffer_start = 1
    chunk_index = 0
    char_count = 0

    for line_no, line in enumerate(lines, start=1):
        buffer.append(line)
        char_count += len(line) + 1

        if char_count >= CODE_CHUNK_SIZE:
            text = "\n".join(buffer).strip()
            if text:
                chunks.append(
                    CodeChunk(
                        text=text,
                        file_path=file_path,
                        chunk_index=chunk_index,
                        start_line=buffer_start,
                    )
                )
                chunk_index += 1

            overlap_lines: list[str] = []
            overlap_chars = 0
            for overlap_line in reversed(buffer):
                if overlap_chars >= CODE_CHUNK_OVERLAP:
                    break
                overlap_lines.insert(0, overlap_line)
                overlap_chars += len(overlap_line) + 1

            buffer = overlap_lines
            buffer_start = line_no - len(overlap_lines) + 1
            char_count = sum(len(item) + 1 for item in buffer)

    if buffer:
        text = "\n".join(buffer).strip()
        if text:
            chunks.append(
                CodeChunk(
                    text=text,
                    file_path=file_path,
                    chunk_index=chunk_index,
                    start_line=buffer_start,
                )
            )

    return chunks


def index_repo(repo_id: str) -> dict:
    repo = get_repo(repo_id)
    collection = get_code_collection()
    model = get_embedding_model()

    # Remove prior chunks for this repo
    try:
        existing = collection.get(where={"repo_id": repo_id})
        if existing and existing.get("ids"):
            collection.delete(ids=existing["ids"])
    except Exception:
        pass

    all_chunks: list[CodeChunk] = []
    for file_info in repo.files:
        try:
            content = read_file(repo_id, file_info.path)
            all_chunks.extend(chunk_file_content(file_info.path, content))
        except Exception:
            continue

    if not all_chunks:
        raise ValueError("No indexable content found in repository.")

    texts = [chunk.text for chunk in all_chunks]
    embeddings = model.encode(texts, show_progress_bar=False).tolist()
    ids = [f"{repo_id}:{chunk.file_path}:{chunk.chunk_index}" for chunk in all_chunks]
    metadatas = [
        {
            "repo_id": repo_id,
            "file_path": chunk.file_path,
            "chunk_index": chunk.chunk_index,
            "start_line": chunk.start_line,
            "repo_name": repo.name,
        }
        for chunk in all_chunks
    ]

    collection.add(
        ids=ids,
        documents=texts,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    return {
        "repo_id": repo_id,
        "indexed_chunks": len(all_chunks),
        "indexed_files": len({chunk.file_path for chunk in all_chunks}),
    }


def retrieve_code(repo_id: str, query: str, top_k: int = 5) -> list[dict]:
    collection = get_code_collection()
    model = get_embedding_model()

    query_embedding = model.encode([query], show_progress_bar=False).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=top_k,
        where={"repo_id": repo_id},
        include=["documents", "metadatas", "distances"],
    )

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    chunks: list[dict] = []
    for index, text in enumerate(documents):
        metadata = metadatas[index] if index < len(metadatas) else {}
        distance = distances[index] if index < len(distances) else None
        score = None if distance is None else round(1 - distance, 4)
        chunks.append({"text": text, "score": score, "metadata": metadata})

    return chunks
