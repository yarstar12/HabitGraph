from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import Goal, User
from app.db.postgres import get_db
from app.db.neo4j import link_user_goal, list_goal_catalog, unlink_user_goal
from app.db.rabbitmq import publish_event

router = APIRouter()


class GoalCatalogOut(BaseModel):
    id: int
    title: str
    description: str | None = None


class GoalOut(BaseModel):
    id: int
    user_id: int
    catalog_id: int | None
    title: str
    description: str | None
    is_archived: bool


class GoalSelect(BaseModel):
    catalog_id: int = Field(gt=0)


class GoalUpdate(BaseModel):
    is_archived: bool | None = None


@router.get("/catalog", response_model=list[GoalCatalogOut])
def get_catalog() -> list[dict]:
    return list_goal_catalog()


@router.post("", response_model=GoalOut)
def select_goal(
    payload: GoalSelect,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Goal:
    catalog = {item["id"]: item for item in list_goal_catalog()}
    item = catalog.get(payload.catalog_id)
    if not item:
        raise HTTPException(status_code=404, detail="Цель не найдена")

    goal = db.scalar(
        select(Goal).where(Goal.user_id == user.id, Goal.catalog_id == payload.catalog_id)
    )
    if goal:
        if goal.is_archived:
            goal.is_archived = False
            goal.title = item["title"]
            goal.description = item.get("description")
            db.commit()
            db.refresh(goal)
        try:
            link_user_goal(user_id=user.id, goal_id=payload.catalog_id)
        except Exception:
            pass
        return goal

    goal = Goal(
        user_id=user.id,
        catalog_id=payload.catalog_id,
        title=item["title"],
        description=item.get("description"),
        is_archived=False,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    try:
        link_user_goal(user_id=user.id, goal_id=payload.catalog_id)
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

    if payload.is_archived is None:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")

    goal.is_archived = payload.is_archived
    db.commit()
    db.refresh(goal)
    if goal.catalog_id is not None:
        try:
            if payload.is_archived:
                unlink_user_goal(user_id=user.id, goal_id=goal.catalog_id)
            else:
                link_user_goal(user_id=user.id, goal_id=goal.catalog_id)
        except Exception:
            pass
    return goal
