import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_user_id
from app.db.models import Checkin, Habit
from app.db.postgres import get_db
from app.db.rabbitmq import publish_event

router = APIRouter()


class CheckinCreate(BaseModel):
    habit_id: int
    date: dt.date | None = None


class CheckinOut(BaseModel):
    id: int
    user_id: int
    habit_id: int
    date: dt.date


@router.post("", response_model=CheckinOut)
def create_checkin(
    payload: CheckinCreate,
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db),
) -> Checkin:
    date = payload.date or dt.date.today()

    habit = db.scalar(select(Habit).where(Habit.id == payload.habit_id, Habit.user_id == user_id))
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")

    checkin = Checkin(user_id=user_id, habit_id=payload.habit_id, date=date)
    db.add(checkin)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Check-in already exists for this day")

    db.refresh(checkin)
    try:
        publish_event(
            "habits.checkin.recorded",
            {"user_id": user_id, "habit_id": payload.habit_id, "date": date.isoformat()},
        )
    except Exception:
        pass
    return checkin
