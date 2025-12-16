import datetime as dt

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_user_id
from app.db.models import Checkin, Habit
from app.db.postgres import get_db

router = APIRouter()


class HabitStats(BaseModel):
    habit_id: int
    title: str
    streak: int
    total_checkins: int
    last_checkin: dt.date | None


class DashboardOut(BaseModel):
    user_id: int
    habits: list[HabitStats]


@router.get("", response_model=DashboardOut)
def get_dashboard(
    user_id: int = Depends(get_user_id),
    db: Session = Depends(get_db),
) -> DashboardOut:
    habits = list(db.scalars(select(Habit).where(Habit.user_id == user_id).order_by(Habit.id)))
    if not habits:
        return DashboardOut(user_id=user_id, habits=[])

    habit_ids = [h.id for h in habits]
    rows = db.execute(
        select(
            Checkin.habit_id,
            func.count(Checkin.id).label("total"),
            func.max(Checkin.date).label("last_date"),
        )
        .where(Checkin.user_id == user_id, Checkin.habit_id.in_(habit_ids))
        .group_by(Checkin.habit_id)
    ).all()

    by_habit: dict[int, tuple[int, dt.date | None]] = {r[0]: (int(r[1]), r[2]) for r in rows}
    from app.db.redis import get_streak

    return DashboardOut(
        user_id=user_id,
        habits=[
            HabitStats(
                habit_id=h.id,
                title=h.title,
                streak=get_streak(db=db, user_id=user_id, habit_id=h.id),
                total_checkins=by_habit.get(h.id, (0, None))[0],
                last_checkin=by_habit.get(h.id, (0, None))[1],
            )
            for h in habits
        ],
    )
