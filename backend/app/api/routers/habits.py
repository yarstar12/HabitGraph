from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import Goal, Habit, User
from app.db.postgres import get_db
from app.db.neo4j import link_user_habit
from app.db.rabbitmq import publish_event

router = APIRouter()


class HabitCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    frequency: str | None = Field(default=None, max_length=32)
    target_value: int | None = Field(default=None, ge=1)
    target_unit: str | None = Field(default=None, max_length=32)
    reminder_time: str | None = Field(default=None, max_length=16)
    goal_id: int | None = None


class HabitOut(BaseModel):
    id: int
    user_id: int
    title: str
    frequency: str | None
    target_value: int | None
    target_unit: str | None
    reminder_time: str | None
    goal_id: int | None
    is_archived: bool


class HabitUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    frequency: str | None = Field(default=None, max_length=32)
    target_value: int | None = Field(default=None, ge=1)
    target_unit: str | None = Field(default=None, max_length=32)
    reminder_time: str | None = Field(default=None, max_length=16)
    goal_id: int | None = None
    is_archived: bool | None = None


@router.post("", response_model=HabitOut)
def create_habit(
    payload: HabitCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Habit:
    if payload.goal_id is not None:
        goal = db.scalar(select(Goal).where(Goal.id == payload.goal_id, Goal.user_id == user.id))
        if goal is None:
            raise HTTPException(status_code=404, detail="Цель не найдена")

    habit = Habit(
        user_id=user.id,
        title=payload.title,
        frequency=payload.frequency,
        target_value=payload.target_value,
        target_unit=payload.target_unit,
        reminder_time=payload.reminder_time,
        goal_id=payload.goal_id,
        is_archived=False,
    )
    db.add(habit)
    db.commit()
    db.refresh(habit)
    try:
        link_user_habit(user_id=user.id, habit_id=habit.id, title=habit.title)
    except Exception:
        pass
    try:
        publish_event("user.habits.changed", {"user_id": user.id, "habit_id": habit.id})
    except Exception:
        pass
    return habit


@router.get("", response_model=list[HabitOut])
def list_habits(
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Habit]:
    query = select(Habit).where(Habit.user_id == user.id)
    if status == "active" or status is None:
        query = query.where(Habit.is_archived.is_(False))
    elif status == "archived":
        query = query.where(Habit.is_archived.is_(True))
    return list(db.scalars(query.order_by(Habit.id)))


@router.patch("/{habit_id}", response_model=HabitOut)
def update_habit(
    habit_id: int,
    payload: HabitUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Habit:
    habit = db.scalar(select(Habit).where(Habit.id == habit_id, Habit.user_id == user.id))
    if habit is None:
        raise HTTPException(status_code=404, detail="Привычка не найдена")

    if payload.goal_id is not None:
        goal = db.scalar(select(Goal).where(Goal.id == payload.goal_id, Goal.user_id == user.id))
        if goal is None:
            raise HTTPException(status_code=404, detail="Цель не найдена")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(habit, field, value)
    db.commit()
    db.refresh(habit)
    if "title" in updates:
        try:
            link_user_habit(user_id=user.id, habit_id=habit.id, title=habit.title)
        except Exception:
            pass
    return habit
