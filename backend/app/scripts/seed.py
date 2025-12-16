import datetime as dt

from sqlalchemy import select

from app.core.settings import settings
from app.db.models import Checkin, Goal, Habit, User
from app.db.mongo import get_diary_collection
from app.db.neo4j import add_friend, link_user_goal, link_user_habit, upsert_user
from app.db.postgres import SessionLocal, init_db
from app.db.qdrant import upsert_diary_entry
from app.db.redis import compute_and_store_streak


def _get_or_create_user(db, username: str) -> User:
    user = db.scalar(select(User).where(User.username == username))
    if user:
        return user
    user = User(username=username)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_habit(db, user_id: int, title: str) -> Habit:
    habit = Habit(user_id=user_id, title=title)
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


def _create_goal(db, user_id: int, title: str) -> Goal:
    goal = Goal(user_id=user_id, title=title)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


def _add_checkins(db, user_id: int, habit_id: int, dates: list[dt.date]) -> None:
    for d in dates:
        exists = db.scalar(
            select(Checkin.id).where(Checkin.user_id == user_id, Checkin.habit_id == habit_id, Checkin.date == d)
        )
        if exists:
            continue
        db.add(Checkin(user_id=user_id, habit_id=habit_id, date=d))
    db.commit()


def main() -> None:
    print("Загрузка демо-данных HabitGraph…")
    init_db()

    db = SessionLocal()
    try:
        alice = _get_or_create_user(db, "alice")
        bob = _get_or_create_user(db, "bob")
        carol = _get_or_create_user(db, "carol")

        for u in [alice, bob, carol]:
            try:
                upsert_user(user_id=u.id, username=u.username)
            except Exception:
                pass

        # Habits / Goals
        a_h1 = _create_habit(db, alice.id, "10k steps")
        a_h2 = _create_habit(db, alice.id, "Drink water")
        a_g1 = _create_goal(db, alice.id, "Improve sleep")

        b_h1 = _create_habit(db, bob.id, "Gym")
        b_g1 = _create_goal(db, bob.id, "Lose weight")

        c_h1 = _create_habit(db, carol.id, "10k steps")
        c_g1 = _create_goal(db, carol.id, "Improve sleep")

        # Neo4j links
        for (uid, hid, title) in [
            (alice.id, a_h1.id, a_h1.title),
            (alice.id, a_h2.id, a_h2.title),
            (bob.id, b_h1.id, b_h1.title),
            (carol.id, c_h1.id, c_h1.title),
        ]:
            try:
                link_user_habit(user_id=uid, habit_id=hid, title=title)
            except Exception:
                pass

        for (uid, gid, title) in [
            (alice.id, a_g1.id, a_g1.title),
            (bob.id, b_g1.id, b_g1.title),
            (carol.id, c_g1.id, c_g1.title),
        ]:
            try:
                link_user_goal(user_id=uid, goal_id=gid, title=title)
            except Exception:
                pass

        try:
            add_friend(user_id=alice.id, friend_user_id=bob.id)
        except Exception:
            pass

        # Check-ins (create streak for Alice on 10k steps)
        today = dt.date.today()
        _add_checkins(db, alice.id, a_h1.id, [today - dt.timedelta(days=i) for i in range(5)])
        _add_checkins(db, alice.id, a_h2.id, [today - dt.timedelta(days=i) for i in [0, 2, 4]])
        _add_checkins(db, bob.id, b_h1.id, [today - dt.timedelta(days=i) for i in range(2)])
        _add_checkins(db, carol.id, c_h1.id, [today - dt.timedelta(days=i) for i in [0, 1, 3]])

        # Redis streak counters
        for (uid, hid) in [
            (alice.id, a_h1.id),
            (alice.id, a_h2.id),
            (bob.id, b_h1.id),
            (carol.id, c_h1.id),
        ]:
            try:
                compute_and_store_streak(db=db, user_id=uid, habit_id=hid, end_date=today)
            except Exception:
                pass

        # Mongo diary entries + Qdrant vectors
        diary = get_diary_collection()
        entries = [
            {
                "user_id": alice.id,
                "text": "Slept 7h, felt better. 10k steps done and drank enough water.",
                "tags": ["sleep", "steps", "water"],
                "mood": "good",
                "metadata": {"sleep_hours": 7, "steps": 10000},
            },
            {
                "user_id": alice.id,
                "text": "Bad mood today, but still walked 8k steps. Need to go to bed earlier.",
                "tags": ["steps", "sleep"],
                "mood": "meh",
                "metadata": {"steps": 8000},
            },
            {
                "user_id": bob.id,
                "text": "Gym session: squats and bench. Feeling strong!",
                "tags": ["gym", "workout"],
                "mood": "great",
                "metadata": {"workout": ["squat", "bench"]},
            },
            {
                "user_id": carol.id,
                "text": "Trying to improve sleep schedule. Walked 10k steps, mood is calm.",
                "tags": ["sleep", "steps"],
                "mood": "calm",
                "metadata": {"steps": 10000},
            },
        ]

        now = dt.datetime.now(tz=dt.UTC)
        for e in entries:
            doc = dict(e)
            doc["created_at"] = now
            inserted = diary.insert_one(doc)
            entry_id = str(inserted.inserted_id)
            try:
                upsert_diary_entry(
                    entry_id=entry_id,
                    user_id=doc["user_id"],
                    text=doc["text"],
                    tags=doc.get("tags", []),
                    mood=doc.get("mood"),
                    created_at=doc["created_at"],
                )
            except Exception:
                pass

        print("Готово.")
        print("Проверь:")
        print("  - GET  /dashboard   (X-User-Id: 1)")
        print("  - GET  /diary/similar?text=steps")
        print("  - GET  /social/recommendations")
    finally:
        db.close()


if __name__ == "__main__":
    main()
