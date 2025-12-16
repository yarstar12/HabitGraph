from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.postgres import get_db
from app.db.neo4j import upsert_user

router = APIRouter()


class UserCreate(BaseModel):
    username: str


class UserOut(BaseModel):
    id: int
    username: str


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
