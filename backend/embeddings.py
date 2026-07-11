from __future__ import annotations

import uuid

import chromadb
from sentence_transformers import SentenceTransformer

from config import CHROMA_DIR, COLLECTION_NAME, EMBEDDING_MODEL
from ingestion import DocumentChunk

_model: SentenceTransformer | None = None
_client: chromadb.PersistentClient | None = None


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def get_chroma_collection():
    global _client
    if _client is None:
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))

    return _client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def store_chunks(
    document_id: str,
    filename: str,
    chunks: list[DocumentChunk],
) -> int:
    collection = get_chroma_collection()
    model = get_embedding_model()

    texts = [chunk.text for chunk in chunks]
    embeddings = model.encode(texts, show_progress_bar=False).tolist()
    ids = [f"{document_id}:{chunk.chunk_index}" for chunk in chunks]
    metadatas = [
        {
            "document_id": document_id,
            "filename": filename,
            "chunk_index": chunk.chunk_index,
            "source": chunk.source,
        }
        for chunk in chunks
    ]

    collection.add(
        ids=ids,
        documents=texts,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    return len(chunks)


def ingest_document(file_path: str, document_id: str | None = None) -> dict:
    from ingestion import ingest_file

    filename, chunks = ingest_file(file_path)
    doc_id = document_id or str(uuid.uuid4())
    chunk_count = store_chunks(doc_id, filename, chunks)

    return {
        "document_id": doc_id,
        "filename": filename,
        "chunk_count": chunk_count,
    }
