from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.settings import settings
from app.db.models import Base

engine = create_engine(settings.postgres_sqlalchemy_dsn(), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def ensure_database_exists() -> None:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

    host = settings.postgres_host or settings.db_host
    port = settings.postgres_port
    user = settings.postgres_user
    password = settings.postgres_password
    db_name = settings.effective_postgres_db()

    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database="postgres",
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
        exists = cursor.fetchone()
        if not exists:
            cursor.execute(f'CREATE DATABASE "{db_name}"')

        cursor.close()
        conn.close()
    except Exception:
        pass


def init_db() -> None:
    ensure_database_exists()
    Base.metadata.create_all(bind=engine)
    ensure_schema()


def _get_columns(conn, table_name: str) -> set[str]:
    rows = conn.execute(
        text(
            "SELECT column_name "
            "FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=:table"
        ),
        {"table": table_name},
    )
    return {row[0] for row in rows}


def _has_fk(conn, table_name: str, column_name: str) -> bool:
    row = conn.execute(
        text(
            "SELECT 1 "
            "FROM information_schema.key_column_usage "
            "WHERE table_schema='public' AND table_name=:table AND column_name=:column "
            "LIMIT 1"
        ),
        {"table": table_name, "column": column_name},
    ).fetchone()
    return row is not None


def ensure_schema() -> None:
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                "SELECT table_name "
                "FROM information_schema.tables "
                "WHERE table_schema='public' AND table_type='BASE TABLE'"
            )
        )
        tables = {row[0] for row in rows}

        if "habits" in tables:
            cols = _get_columns(conn, "habits")
            if "frequency" not in cols:
                conn.execute(text("ALTER TABLE habits ADD COLUMN frequency VARCHAR(32)"))
            if "target_value" not in cols:
                conn.execute(text("ALTER TABLE habits ADD COLUMN target_value INTEGER"))
            if "target_unit" not in cols:
                conn.execute(text("ALTER TABLE habits ADD COLUMN target_unit VARCHAR(32)"))
            if "reminder_time" not in cols:
                conn.execute(text("ALTER TABLE habits ADD COLUMN reminder_time VARCHAR(16)"))
            if "goal_id" not in cols:
                conn.execute(text("ALTER TABLE habits ADD COLUMN goal_id INTEGER"))
            if "is_archived" not in cols:
                conn.execute(
                    text("ALTER TABLE habits ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE")
                )
            if "goals" in tables and not _has_fk(conn, "habits", "goal_id"):
                try:
                    conn.execute(
                        text(
                            "ALTER TABLE habits "
                            "ADD CONSTRAINT habits_goal_id_fkey "
                            "FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL"
                        )
                    )
                except Exception:
                    pass

        if "goals" in tables:
            cols = _get_columns(conn, "goals")
            if "catalog_id" not in cols:
                conn.execute(text("ALTER TABLE goals ADD COLUMN catalog_id INTEGER"))
            if "description" not in cols:
                conn.execute(text("ALTER TABLE goals ADD COLUMN description VARCHAR(255)"))
            if "is_archived" not in cols:
                conn.execute(
                    text("ALTER TABLE goals ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE")
                )




def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
