from __future__ import annotations

from config import DEFAULT_TOP_K
from embeddings import get_chroma_collection, get_embedding_model


def retrieve_chunks(
    document_id: str,
    query: str,
    top_k: int = DEFAULT_TOP_K,
) -> list[dict]:
    collection = get_chroma_collection()
    model = get_embedding_model()

    query_embedding = model.encode([query], show_progress_bar=False).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=top_k,
        where={"document_id": document_id},
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

        chunks.append(
            {
                "text": text,
                "score": score,
                "metadata": metadata,
            }
        )

    return chunks
