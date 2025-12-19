from sqlalchemy import delete

from app.db.models import Goal
from app.db.neo4j import clear_goal_graph, ensure_goal_catalog
from app.db.postgres import SessionLocal, init_db


def reset_postgres_goals() -> None:
    db = SessionLocal()
    try:
        db.execute(delete(Goal))
        db.commit()
    finally:
        db.close()


def reset_neo4j_goals() -> None:
    clear_goal_graph()
    ensure_goal_catalog()


def main() -> None:
    print("Сброс целей HabitGraph (без удаления привычек и дневника)…")
    init_db()

    try:
        reset_postgres_goals()
        print("✓ PostgreSQL: цели очищены")
    except Exception as e:
        print(f"⚠ PostgreSQL: не удалось очистить цели ({e})")

    try:
        reset_neo4j_goals()
        print("✓ Neo4j: цели очищены и каталог пересоздан")
    except Exception as e:
        print(f"⚠ Neo4j: не удалось очистить цели ({e})")

    print("Готово.")


if __name__ == "__main__":
    main()
