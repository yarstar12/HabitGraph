from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import get_user_id
from app.db.neo4j import add_friend, recommend_users

router = APIRouter()


class AddFriendIn(BaseModel):
    friend_user_id: int


class RecommendationOut(BaseModel):
    user_id: int
    username: str | None = None
    shared_goals: int
    shared_habits: int
    score: int


@router.post("/friends")
def add_friendship(payload: AddFriendIn, user_id: int = Depends(get_user_id)) -> dict:
    if payload.friend_user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")
    add_friend(user_id=user_id, friend_user_id=payload.friend_user_id)
    return {"status": "ok"}


@router.get("/recommendations", response_model=list[RecommendationOut])
def get_recommendations(user_id: int = Depends(get_user_id), limit: int = 10) -> list[dict]:
    return recommend_users(user_id=user_id, limit=min(max(1, limit), 50))

