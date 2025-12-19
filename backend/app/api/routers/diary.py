import datetime as dt
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.db.mongo import get_diary_collection
from app.db.qdrant import delete_diary_entry, upsert_diary_entry, vector_search_diary
from app.db.rabbitmq import publish_event
from app.db.models import User

router = APIRouter()


class DiaryCreate(BaseModel):
    text: str = Field(min_length=1, max_length=10_000)
    tags: list[str] = []
    mood: str | None = None
    metadata: dict[str, Any] = {}


class DiaryUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=10_000)
    tags: list[str] | None = None
    mood: str | None = None
    metadata: dict[str, Any] | None = None


class DiaryOut(BaseModel):
    id: str
    user_id: int
    text: str
    tags: list[str]
    mood: str | None
    metadata: dict[str, Any]
    created_at: dt.datetime
    updated_at: dt.datetime | None = None


class DiaryListOut(BaseModel):
    items: list[DiaryOut]
    total: int
    limit: int
    offset: int
    sort: str


@router.post("", response_model=DiaryOut)
def create_entry(payload: DiaryCreate, user: User = Depends(get_current_user)) -> DiaryOut:
    col = get_diary_collection()
    doc = {
        "user_id": user.id,
        "text": payload.text,
        "tags": payload.tags,
        "mood": payload.mood,
        "metadata": payload.metadata,
        "created_at": dt.datetime.now(tz=dt.UTC),
        "updated_at": None,
    }
    inserted = col.insert_one(doc)
    doc["_id"] = inserted.inserted_id

    try:
        upsert_diary_entry(
            entry_id=str(doc["_id"]),
            user_id=user.id,
            text=payload.text,
            tags=payload.tags,
            mood=payload.mood,
            created_at=doc["created_at"],
        )
    except Exception:
        pass

    try:
        publish_event("diary.entry.created", {"user_id": user.id, "entry_id": str(doc["_id"])})
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
        updated_at=doc.get("updated_at"),
    )


@router.get("", response_model=DiaryListOut)
def list_entries(
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    sort: str = "desc",
) -> DiaryListOut:
    col = get_diary_collection()
    limit = min(max(1, limit), 100)
    offset = max(0, offset)
    sort_dir = -1 if sort == "desc" else 1
    total = int(col.count_documents({"user_id": user.id}))
    cursor = (
        col.find({"user_id": user.id})
        .sort("created_at", sort_dir)
        .skip(offset)
        .limit(limit)
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
                updated_at=doc.get("updated_at"),
            )
        )
    return DiaryListOut(items=items, total=total, limit=limit, offset=offset, sort=sort)


def _get_entry_by_id(entry_id: str):
    col = get_diary_collection()
    try:
        oid = ObjectId(entry_id)
    except Exception:
        return None
    return col.find_one({"_id": oid})


class SimilarOut(BaseModel):
    entry: DiaryOut
    score: float


@router.get("/similar", response_model=list[SimilarOut])
def similar_entries(
    user: User = Depends(get_current_user),
    text: str | None = None,
    entry_id: str | None = None,
    limit: int = 5,
) -> list[SimilarOut]:
    if not text and not entry_id:
        raise HTTPException(status_code=400, detail="Нужно передать text или entry_id")

    query_text = text
    if entry_id:
        doc = _get_entry_by_id(entry_id)
        if not doc or doc.get("user_id") != user.id:
            raise HTTPException(status_code=404, detail="Запись дневника не найдена")
        query_text = doc.get("text") or ""

    results = vector_search_diary(user_id=user.id, text=query_text or "", limit=min(max(1, limit), 20))

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
                    updated_at=doc.get("updated_at"),
                ),
                score=float(r["score"]),
            )
        )
    return out


@router.patch("/{entry_id}", response_model=DiaryOut)
def update_entry(
    entry_id: str,
    payload: DiaryUpdate,
    user: User = Depends(get_current_user),
) -> DiaryOut:
    col = get_diary_collection()
    doc = _get_entry_by_id(entry_id)
    if not doc or doc.get("user_id") != user.id:
        raise HTTPException(status_code=404, detail="Запись дневника не найдена")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return DiaryOut(
            id=str(doc["_id"]),
            user_id=doc["user_id"],
            text=doc.get("text", ""),
            tags=doc.get("tags", []),
            mood=doc.get("mood"),
            metadata=doc.get("metadata", {}),
            created_at=doc.get("created_at") or dt.datetime.now(tz=dt.UTC),
            updated_at=doc.get("updated_at"),
        )

    updates["updated_at"] = dt.datetime.now(tz=dt.UTC)
    col.update_one({"_id": doc["_id"]}, {"$set": updates})
    doc = _get_entry_by_id(entry_id)

    if payload.text is not None:
        try:
            upsert_diary_entry(
                entry_id=str(doc["_id"]),
                user_id=user.id,
                text=doc.get("text", ""),
                tags=doc.get("tags", []),
                mood=doc.get("mood"),
                created_at=doc.get("created_at") or dt.datetime.now(tz=dt.UTC),
            )
        except Exception:
            pass

    return DiaryOut(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        text=doc.get("text", ""),
        tags=doc.get("tags", []),
        mood=doc.get("mood"),
        metadata=doc.get("metadata", {}),
        created_at=doc.get("created_at") or dt.datetime.now(tz=dt.UTC),
        updated_at=doc.get("updated_at"),
    )


@router.delete("/{entry_id}")
def delete_entry(entry_id: str, user: User = Depends(get_current_user)) -> dict:
    col = get_diary_collection()
    doc = _get_entry_by_id(entry_id)
    if not doc or doc.get("user_id") != user.id:
        raise HTTPException(status_code=404, detail="Запись дневника не найдена")

    col.delete_one({"_id": doc["_id"]})
    try:
        delete_diary_entry(entry_id=entry_id)
    except Exception:
        pass

    return {"status": "ok"}
