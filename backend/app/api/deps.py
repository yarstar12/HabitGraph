from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.neo4j import upsert_user
from app.db.postgres import get_db


def get_user_id(x_user_id: int | None = Header(default=None, alias="X-User-Id")) -> int:
    return x_user_id or 1


def get_current_user(
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        user = User(id=user_id, username=f"user_{user_id}")
        db.add(user)
        db.commit()
        db.refresh(user)
        try:
            upsert_user(user_id=user.id, username=user.username)
        except Exception:
            pass
    return user
