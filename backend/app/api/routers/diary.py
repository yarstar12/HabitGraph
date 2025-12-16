import datetime as dt
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import get_user_id
from app.db.mongo import get_diary_collection

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

