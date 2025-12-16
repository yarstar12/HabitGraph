from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_user_id
from app.db.models import Goal
from app.db.postgres import get_db
from app.db.neo4j import link_user_goal
from app.db.rabbitmq import publish_event

router = APIRouter()


class GoalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class GoalOut(BaseModel):
    id: int
    user_id: int
    title: str


@router.post("", response_model=GoalOut)
def create_goal(
    payload: GoalCreate,
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db),
) -> Goal:
    goal = Goal(user_id=user_id, title=payload.title)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    try:
        link_user_goal(user_id=user_id, goal_id=goal.id, title=goal.title)
    except Exception:
        pass
    try:
        publish_event("user.goals.changed", {"user_id": user_id, "goal_id": goal.id})
    except Exception:
        pass
    return goal


@router.get("", response_model=list[GoalOut])
def list_goals(
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db),
) -> list[Goal]:
    return list(db.scalars(select(Goal).where(Goal.user_id == user_id).order_by(Goal.id)))
