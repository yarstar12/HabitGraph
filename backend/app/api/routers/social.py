from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.db.neo4j import add_friend, list_friends, recommend_users
from app.db.models import User

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
def add_friendship(payload: AddFriendIn, user: User = Depends(get_current_user)) -> dict:
    if payload.friend_user_id == user.id:
        raise HTTPException(status_code=400, detail="Нельзя добавить в друзья самого себя")
    add_friend(user_id=user.id, friend_user_id=payload.friend_user_id)
    return {"status": "ok"}


@router.get("/recommendations", response_model=list[RecommendationOut])
def get_recommendations(user: User = Depends(get_current_user), limit: int = 10) -> list[dict]:
    return recommend_users(user_id=user.id, limit=min(max(1, limit), 50))


class FriendOut(BaseModel):
    user_id: int
    username: str | None = None


@router.get("/friends", response_model=list[FriendOut])
def get_friends(user: User = Depends(get_current_user)) -> list[dict]:
    return list_friends(user_id=user.id)
