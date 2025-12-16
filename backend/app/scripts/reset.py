from app.db.mongo import get_mongo_client
from app.db.neo4j import get_driver
from app.db.postgres import engine, init_db
from app.db.qdrant import get_qdrant_client
from app.db.redis import get_redis
from app.db.models import Base
from app.core.settings import settings


def reset_postgres() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def reset_mongo() -> None:
    client = get_mongo_client()
    client.drop_database(settings.effective_mongo_db())


def reset_redis() -> None:
    r = get_redis()
    r.flushdb()


def reset_qdrant() -> None:
    client = get_qdrant_client()
    name = settings.effective_qdrant_collection()
    try:
        client.delete_collection(collection_name=name)
    except Exception:
        pass


def reset_neo4j() -> None:
    driver = get_driver()
    with driver.session() as session:
        session.run("MATCH (n:User) DETACH DELETE n")
        session.run("MATCH (n:Goal) DETACH DELETE n")
        session.run("MATCH (n:Habit) DETACH DELETE n")


def main() -> None:
    print("Сброс данных HabitGraph (удаление всех записей приложения)…")

    # Ensure DB exists (remote may require creation)
    init_db()

    try:
        reset_postgres()
        print("✓ PostgreSQL очищен")
    except Exception as e:
        print(f"⚠ PostgreSQL: не удалось очистить ({e})")

    try:
        reset_mongo()
        print("✓ MongoDB очищена")
    except Exception as e:
        print(f"⚠ MongoDB: не удалось очистить ({e})")

    try:
        reset_redis()
        print("✓ Redis очищен")
    except Exception as e:
        print(f"⚠ Redis: не удалось очистить ({e})")

    try:
        reset_qdrant()
        print("✓ Qdrant очищен")
    except Exception as e:
        print(f"⚠ Qdrant: не удалось очистить ({e})")

    try:
        reset_neo4j()
        print("✓ Neo4j очищен")
    except Exception as e:
        print(f"⚠ Neo4j: не удалось очистить ({e})")

    print("Готово. Теперь пользователь может заполнять всё вручную.")


if __name__ == "__main__":
    main()

