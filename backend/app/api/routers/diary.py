import datetime as dt
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_user_id
from app.db.mongo import get_diary_collection
from app.db.qdrant import upsert_diary_entry, vector_search_diary
from app.db.rabbitmq import publish_event

router = APIRouter()


class DiaryCreate(BaseModel):
    text: str = Field(min_length=1, max_length=10_000)
    tags: list[str] = []
    mood: str | None = None
    metadata: dict[str, Any] = {}


class DiaryOut(BaseModel):
    id: str
    user_id: int
    text: str
    tags: list[str]
    mood: str | None
    metadata: dict[str, Any]
    created_at: dt.datetime


@router.post("", response_model=DiaryOut)
def create_entry(payload: DiaryCreate, user_id: int = Depends(get_user_id)) -> DiaryOut:
    col = get_diary_collection()
    doc = {
        "user_id": user_id,
        "text": payload.text,
        "tags": payload.tags,
        "mood": payload.mood,
        "metadata": payload.metadata,
        "created_at": dt.datetime.now(tz=dt.UTC),
    }
    inserted = col.insert_one(doc)
    doc["_id"] = inserted.inserted_id

    try:
        upsert_diary_entry(
            entry_id=str(doc["_id"]),
            user_id=user_id,
            text=payload.text,
            tags=payload.tags,
            mood=payload.mood,
            created_at=doc["created_at"],
        )
    except Exception:
        pass

    try:
        publish_event("diary.entry.created", {"user_id": user_id, "entry_id": str(doc["_id"])})
    except Exception:
        pass

    return DiaryOut(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        text=doc["text"],
        tags=doc["tags"],
        mood=doc["mood"],
        metadata=doc["metadata"],
        created_at=doc["created_at"],
    )


@router.get("", response_model=list[DiaryOut])
def list_entries(
    user_id: int = Depends(get_user_id),
    limit: int = 50,
    offset: int = 0,
) -> list[DiaryOut]:
    col = get_diary_collection()
    cursor = (
        col.find({"user_id": user_id})
        .sort("created_at", -1)
        .skip(max(0, offset))
        .limit(min(max(1, limit), 200))
    )

    items: list[DiaryOut] = []
    for doc in cursor:
        items.append(
            DiaryOut(
                id=str(doc["_id"]),
                user_id=doc["user_id"],
                text=doc.get("text", ""),
                tags=doc.get("tags", []),
                mood=doc.get("mood"),
                metadata=doc.get("metadata", {}),
                created_at=doc.get("created_at") or dt.datetime.now(tz=dt.UTC),
            )
        )
    return items


def _get_entry_by_id(entry_id: str):
    col = get_diary_collection()
    return col.find_one({"_id": ObjectId(entry_id)})


class SimilarOut(BaseModel):
    entry: DiaryOut
    score: float


@router.get("/similar", response_model=list[SimilarOut])
def similar_entries(
    user_id: int = Depends(get_user_id),
    text: str | None = None,
    entry_id: str | None = None,
    limit: int = 5,
) -> list[SimilarOut]:
    if not text and not entry_id:
        raise HTTPException(status_code=400, detail="Provide text or entry_id")

    query_text = text
    if entry_id:
        doc = _get_entry_by_id(entry_id)
        if not doc or doc.get("user_id") != user_id:
            raise HTTPException(status_code=404, detail="Diary entry not found")
        query_text = doc.get("text") or ""

    results = vector_search_diary(user_id=user_id, text=query_text or "", limit=min(max(1, limit), 20))

    col = get_diary_collection()
    out: list[SimilarOut] = []
    for r in results:
        doc = col.find_one({"_id": ObjectId(r["entry_id"])})
        if not doc:
            continue
        out.append(
            SimilarOut(
                entry=DiaryOut(
                    id=str(doc["_id"]),
                    user_id=doc["user_id"],
                    text=doc.get("text", ""),
                    tags=doc.get("tags", []),
                    mood=doc.get("mood"),
                    metadata=doc.get("metadata", {}),
                    created_at=doc.get("created_at") or dt.datetime.now(tz=dt.UTC),
                ),
                score=float(r["score"]),
            )
        )
    return out
