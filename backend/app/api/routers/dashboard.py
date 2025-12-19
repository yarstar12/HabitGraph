import datetime as dt

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import Checkin, Habit, User
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardOut:
    habits = list(
        db.scalars(
            select(Habit)
            .where(Habit.user_id == user.id, Habit.is_archived.is_(False))
            .order_by(Habit.id)
        )
    )
    if not habits:
        return DashboardOut(user_id=user.id, habits=[])

    habit_ids = [h.id for h in habits]
    rows = db.execute(
        select(
            Checkin.habit_id,
            func.count(Checkin.id).label("total"),
            func.max(Checkin.date).label("last_date"),
        )
        .where(Checkin.user_id == user.id, Checkin.habit_id.in_(habit_ids))
        .group_by(Checkin.habit_id)
    ).all()

    by_habit: dict[int, tuple[int, dt.date | None]] = {r[0]: (int(r[1]), r[2]) for r in rows}
    from app.db.redis import get_streak

    return DashboardOut(
        user_id=user.id,
        habits=[
            HabitStats(
                habit_id=h.id,
                title=h.title,
                streak=get_streak(db=db, user_id=user.id, habit_id=h.id),
                total_checkins=by_habit.get(h.id, (0, None))[0],
                last_checkin=by_habit.get(h.id, (0, None))[1],
            )
            for h in habits
        ],
    )


class TodayHabit(BaseModel):
    habit_id: int
    title: str
    done: bool


class ActivityPoint(BaseModel):
    date: dt.date
    count: int


class DashboardSummaryOut(BaseModel):
    user_id: int
    today_done: int
    today_total: int
    habits_today: list[TodayHabit]
    week_activity: list[ActivityPoint]
    streak_total: int
    habits_count: int
    goals_count: int
    diary_entries: int


@router.get("/summary", response_model=DashboardSummaryOut)
def get_dashboard_summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardSummaryOut:
    from app.db.mongo import get_diary_collection
    from app.db.redis import get_streak
    from app.db.models import Goal

    today = dt.date.today()
    since = today - dt.timedelta(days=6)

    habits = list(
        db.scalars(
            select(Habit)
            .where(Habit.user_id == user.id, Habit.is_archived.is_(False))
            .order_by(Habit.id)
        )
    )
    habit_ids = [h.id for h in habits]

    rows = db.execute(
        select(Checkin.habit_id, func.max(Checkin.date).label("last_date"))
        .where(Checkin.user_id == user.id, Checkin.habit_id.in_(habit_ids))
        .group_by(Checkin.habit_id)
    ).all()
    last_by_habit: dict[int, dt.date | None] = {r[0]: r[1] for r in rows}

    today_done = 0
    habits_today: list[TodayHabit] = []
    for h in habits:
        last_date = last_by_habit.get(h.id)
        done = last_date == today
        if done:
            today_done += 1
        habits_today.append(TodayHabit(habit_id=h.id, title=h.title, done=done))

    counts = db.execute(
        select(Checkin.date, func.count(Checkin.id))
        .where(Checkin.user_id == user.id, Checkin.date >= since)
        .group_by(Checkin.date)
    ).all()
    by_date: dict[dt.date, int] = {r[0]: int(r[1]) for r in counts}
    week_activity = [
        ActivityPoint(date=since + dt.timedelta(days=i), count=by_date.get(since + dt.timedelta(days=i), 0))
        for i in range(7)
    ]

    streak_total = 0
    for hid in habit_ids:
        try:
            streak_total += get_streak(db=db, user_id=user.id, habit_id=hid)
        except Exception:
            pass

    habits_count = len(habits)
    goals_count = int(
        db.scalar(select(func.count(Goal.id)).where(Goal.user_id == user.id, Goal.is_archived.is_(False))) or 0
    )

    try:
        col = get_diary_collection()
        diary_entries = int(col.count_documents({"user_id": user.id}))
    except Exception:
        diary_entries = 0

    return DashboardSummaryOut(
        user_id=user.id,
        today_done=today_done,
        today_total=len(habits),
        habits_today=habits_today,
        week_activity=week_activity,
        streak_total=streak_total,
        habits_count=habits_count,
        goals_count=goals_count,
        diary_entries=diary_entries,
    )
