from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.postgres import get_db


def get_user_id(x_user_id: int | None = Header(default=None, alias="X-User-Id")) -> int:
    return x_user_id or 1


def get_current_user(
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user
