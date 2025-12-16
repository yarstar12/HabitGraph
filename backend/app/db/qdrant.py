import datetime as dt
import hashlib
import math
import uuid

from qdrant_client import QdrantClient
from qdrant_client.http import models as qm

from app.core.settings import settings

VECTOR_SIZE = 64

_client: QdrantClient | None = None
_collection_ready = False


def get_qdrant_client() -> QdrantClient:
    global _client
    if _client is None:
        host, port = settings.qdrant_connection()
        _client = QdrantClient(host=host, port=port, check_compatibility=False)
    return _client


def _ensure_collection() -> None:
    global _collection_ready
    if _collection_ready:
        return

    client = get_qdrant_client()
    existing = {c.name for c in client.get_collections().collections}
    if settings.qdrant_collection not in existing:
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=qm.VectorParams(size=VECTOR_SIZE, distance=qm.Distance.COSINE),
        )
    _collection_ready = True


def _point_id(entry_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"habitgraph:diary:{entry_id}"))


def embed_text(text: str) -> list[float]:
    vec = [0.0] * VECTOR_SIZE
    words = [w for w in "".join(ch if ch.isalnum() else " " for ch in text.lower()).split() if w]
    if not words:
        return vec

    for w in words:
        digest = hashlib.blake2b(w.encode("utf-8"), digest_size=8).digest()
        h = int.from_bytes(digest, "big", signed=False)
        idx = h % VECTOR_SIZE
        sign = 1.0 if (h >> 8) & 1 else -1.0
        vec[idx] += sign

    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def upsert_diary_entry(
    entry_id: str,
    user_id: int,
    text: str,
    tags: list[str],
    mood: str | None,
    created_at: dt.datetime,
) -> None:
    _ensure_collection()
    client = get_qdrant_client()

    payload = {
        "entry_id": entry_id,
        "user_id": user_id,
        "tags": tags,
        "mood": mood,
        "created_at": created_at.isoformat(),
    }
    client.upsert(
        collection_name=settings.qdrant_collection,
        points=[
            qm.PointStruct(
                id=_point_id(entry_id),
                vector=embed_text(text),
                payload=payload,
            )
        ],
        wait=True,
    )


def vector_search_diary(user_id: int, text: str, limit: int = 5) -> list[dict]:
    _ensure_collection()
    client = get_qdrant_client()

    query_vector = embed_text(text)
    hits = client.search(
        collection_name=settings.qdrant_collection,
        query_vector=query_vector,
        limit=limit,
        query_filter=qm.Filter(
            must=[qm.FieldCondition(key="user_id", match=qm.MatchValue(value=user_id))]
        ),
    )

    out: list[dict] = []
    for h in hits:
        payload = h.payload or {}
        entry_id = payload.get("entry_id")
        if not entry_id:
            continue
        out.append({"entry_id": entry_id, "score": float(h.score)})
    return out
