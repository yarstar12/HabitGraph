from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.postgres import get_db
from app.db.neo4j import upsert_user

router = APIRouter()


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)


class UserOut(BaseModel):
    id: int
    username: str


class UserUpdate(BaseModel):
    username: str = Field(min_length=2, max_length=64)


@router.post("", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    user = User(username=payload.username)
    db.add(user)
    db.commit()
    db.refresh(user)
    try:
        upsert_user(user_id=user.id, username=user.username)
    except Exception:
        pass
    return user


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)) -> list[User]:
    return list(db.scalars(select(User).order_by(User.id)))


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(payload: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    existing = db.scalar(select(User).where(User.username == payload.username, User.id != user.id))
    if existing:
        raise HTTPException(status_code=409, detail="Это имя уже занято")

    user.username = payload.username
    db.commit()
    db.refresh(user)
    try:
        upsert_user(user_id=user.id, username=user.username)
    except Exception:
        pass
    return user


@router.get("/search", response_model=list[UserOut])
def search_users(
    q: str,
    limit: int = 10,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .where(User.username.ilike(f"%{q}%"), User.id != user.id)
            .order_by(User.username.asc())
            .limit(min(max(1, limit), 20))
        )
    )
