import datetime as dt
import hashlib
import math
import uuid

from qdrant_client import QdrantClient
from qdrant_client.http import models as qm

from app.core.settings import settings

DEFAULT_VECTOR_SIZE = 64

_client: QdrantClient | None = None
_collection_ready = False
_collection_name: str | None = None
_vector_size = DEFAULT_VECTOR_SIZE


def get_qdrant_client() -> QdrantClient:
    global _client
    if _client is None:
        host, port = settings.qdrant_connection()
        _client = QdrantClient(host=host, port=port)
    return _client


def _use_existing_collection(client: QdrantClient, name: str) -> bool:
    global _collection_ready, _collection_name, _vector_size
    try:
        info = client.get_collection(name)
    except Exception:
        return False
    vectors = info.config.params.vectors
    size = getattr(vectors, "size", DEFAULT_VECTOR_SIZE)
    _collection_name = name
    _vector_size = int(size)
    _collection_ready = True
    return True


def _ensure_collection() -> None:
    global _collection_ready, _collection_name, _vector_size
    if _collection_ready:
        return

    client = get_qdrant_client()
    primary = settings.effective_qdrant_collection()

    if _use_existing_collection(client, primary):
        return

    try:
        client.create_collection(
            collection_name=primary,
            vectors_config=qm.VectorParams(size=DEFAULT_VECTOR_SIZE, distance=qm.Distance.COSINE),
        )
        _collection_name = primary
        _vector_size = DEFAULT_VECTOR_SIZE
        _collection_ready = True
        return
    except Exception:
        fallback = settings.fallback_qdrant_collection()
        if fallback and _use_existing_collection(client, fallback):
            return
        raise


def _point_id(entry_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"habitgraph:diary:{entry_id}"))


def embed_text(text: str) -> list[float]:
    size = _vector_size or DEFAULT_VECTOR_SIZE
    vec = [0.0] * size
    words = [w for w in "".join(ch if ch.isalnum() else " " for ch in text.lower()).split() if w]
    if not words:
        return vec

    for w in words:
        digest = hashlib.blake2b(w.encode("utf-8"), digest_size=8).digest()
        h = int.from_bytes(digest, "big", signed=False)
        idx = h % size
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
        collection_name=_collection_name or settings.effective_qdrant_collection(),
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
    try:
        _ensure_collection()
    except Exception:
        return []
    client = get_qdrant_client()

    query_vector = embed_text(text)
    hits = client.search(
        collection_name=_collection_name or settings.effective_qdrant_collection(),
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


def delete_diary_entry(entry_id: str) -> None:
    _ensure_collection()
    client = get_qdrant_client()
    client.delete(
        collection_name=_collection_name or settings.effective_qdrant_collection(),
        points_selector=qm.PointIdsList(points=[_point_id(entry_id)]),
        wait=True,
    )
