import datetime as dt

import redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.db.models import Checkin

_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    return _client


def _streak_key(user_id: int, habit_id: int) -> str:
    return f"streak:{user_id}:{habit_id}"


def compute_streak(db: Session, user_id: int, habit_id: int, end_date: dt.date) -> int:
    dates = db.scalars(
        select(Checkin.date)
        .where(Checkin.user_id == user_id, Checkin.habit_id == habit_id)
        .order_by(Checkin.date.desc())
        .limit(400)
    ).all()
    date_set = set(dates)

    streak = 0
    cur = end_date
    while cur in date_set:
        streak += 1
        cur -= dt.timedelta(days=1)
    return streak


def compute_and_store_streak(db: Session, user_id: int, habit_id: int, end_date: dt.date) -> int:
    streak = compute_streak(db=db, user_id=user_id, habit_id=habit_id, end_date=end_date)
    r = get_redis()
    r.set(_streak_key(user_id, habit_id), str(streak), ex=7 * 24 * 3600)
    return streak


def get_streak(db: Session, user_id: int, habit_id: int) -> int:
    try:
        r = get_redis()
        value = r.get(_streak_key(user_id, habit_id))
        if value is not None:
            return int(value)
    except Exception:
        pass

    try:
        streak = compute_streak(db=db, user_id=user_id, habit_id=habit_id, end_date=dt.date.today())
        try:
            r = get_redis()
            r.set(_streak_key(user_id, habit_id), str(streak), ex=7 * 24 * 3600)
        except Exception:
            pass
        return streak
    except Exception:
        return 0

