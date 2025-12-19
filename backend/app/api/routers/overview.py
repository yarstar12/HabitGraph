import datetime as dt

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import Checkin, Goal, Habit, User
from app.db.mongo import get_diary_collection
from app.db.postgres import get_db
from app.db.redis import get_streak

router = APIRouter()


class OverviewOut(BaseModel):
    user_id: int
    habits_count: int
    goals_count: int
    diary_entries: int
    checkins_last_7_days: int
    streak_total: int
    tips: list[str]


@router.get("", response_model=OverviewOut)
def get_overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OverviewOut:
    today = dt.date.today()
    since = today - dt.timedelta(days=6)

    habits_ids = list(db.scalars(select(Habit.id).where(Habit.user_id == user.id, Habit.is_archived.is_(False))))
    habits_count = len(habits_ids)
    goals_count = int(
        db.scalar(select(func.count(Goal.id)).where(Goal.user_id == user.id, Goal.is_archived.is_(False))) or 0
    )
    checkins_7d = int(
        db.scalar(
            select(func.count(Checkin.id)).where(Checkin.user_id == user.id, Checkin.date >= since)
        )
        or 0
    )

    streak_total = 0
    for hid in habits_ids:
        try:
            streak_total += get_streak(db=db, user_id=user.id, habit_id=hid)
        except Exception:
            pass

    try:
        col = get_diary_collection()
        diary_entries = int(col.count_documents({"user_id": user.id}))
    except Exception:
        diary_entries = 0

    tips: list[str] = []
    if habits_count == 0:
        tips.append("Создай первую привычку или выбери цель из каталога.")
    if checkins_7d == 0 and habits_count > 0:
        tips.append("Отметь выполнение хотя бы одной привычки.")
    if diary_entries == 0:
        tips.append("Добавь запись в дневник, чтобы получить рекомендации.")

    return OverviewOut(
        user_id=user.id,
        habits_count=habits_count,
        goals_count=goals_count,
        diary_entries=diary_entries,
        checkins_last_7_days=checkins_7d,
        streak_total=streak_total,
        tips=tips,
    )
