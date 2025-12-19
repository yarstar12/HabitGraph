from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import Goal, User
from app.db.postgres import get_db
from app.db.neo4j import link_user_goal
from app.db.rabbitmq import publish_event

router = APIRouter()


class GoalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=255)


class GoalOut(BaseModel):
    id: int
    user_id: int
    title: str
    description: str | None
    is_archived: bool


class GoalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=255)
    is_archived: bool | None = None


@router.post("", response_model=GoalOut)
def create_goal(
    payload: GoalCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Goal:
    goal = Goal(user_id=user.id, title=payload.title, description=payload.description, is_archived=False)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    try:
        link_user_goal(user_id=user.id, goal_id=goal.id, title=goal.title)
    except Exception:
        pass
    try:
        publish_event("user.goals.changed", {"user_id": user.id, "goal_id": goal.id})
    except Exception:
        pass
    return goal


@router.get("", response_model=list[GoalOut])
def list_goals(
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Goal]:
    query = select(Goal).where(Goal.user_id == user.id)
    if status == "active" or status is None:
        query = query.where(Goal.is_archived.is_(False))
    elif status == "archived":
        query = query.where(Goal.is_archived.is_(True))
    return list(db.scalars(query.order_by(Goal.id)))


@router.patch("/{goal_id}", response_model=GoalOut)
def update_goal(
    goal_id: int,
    payload: GoalUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Goal:
    goal = db.scalar(select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id))
    if goal is None:
        raise HTTPException(status_code=404, detail="Цель не найдена")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    if "title" in updates:
        try:
            link_user_goal(user_id=user.id, goal_id=goal.id, title=goal.title)
        except Exception:
            pass
    return goal
