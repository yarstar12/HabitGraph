from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_user_id
from app.db.models import Habit
from app.db.postgres import get_db

router = APIRouter()


class HabitCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class HabitOut(BaseModel):
    id: int
    user_id: int
    title: str


@router.post("", response_model=HabitOut)
def create_habit(
    payload: HabitCreate,
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db),
) -> Habit:
    habit = Habit(user_id=user_id, title=payload.title)
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


@router.get("", response_model=list[HabitOut])
def list_habits(
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db),
) -> list[Habit]:
    return list(db.scalars(select(Habit).where(Habit.user_id == user_id).order_by(Habit.id)))

