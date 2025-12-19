from neo4j import GraphDatabase

from app.core.settings import settings

_driver = None
_ready = False

GOAL_CATALOG: list[dict[str, object]] = [
    {
        "id": 1,
        "title": "Здоровый сон",
        "description": "Наладить режим сна и восстановление каждый день."
    },
    {
        "id": 2,
        "title": "Регулярная активность",
        "description": "Добавить движение и тренировки в расписание."
    },
    {
        "id": 3,
        "title": "Снижение стресса",
        "description": "Стабилизировать настроение и сохранять баланс."
    }
]


def get_driver():
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(
            settings.neo4j_bolt_uri(), auth=(settings.neo4j_user, settings.neo4j_password)
        )
    return _driver


def _ensure_schema() -> None:
    global _ready
    if _ready:
        return
    driver = get_driver()
    with driver.session() as session:
        session.run("CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE")
        session.run("CREATE CONSTRAINT goal_id IF NOT EXISTS FOR (g:Goal) REQUIRE g.id IS UNIQUE")
        session.run("CREATE CONSTRAINT habit_id IF NOT EXISTS FOR (h:Habit) REQUIRE h.id IS UNIQUE")
    _ready = True


def upsert_user(user_id: int, username: str) -> None:
    _ensure_schema()
    driver = get_driver()
    with driver.session() as session:
        session.run(
            "MERGE (u:User {id: $id}) SET u.username = $username",
            id=user_id,
            username=username,
        )


def link_user_goal(user_id: int, goal_id: int) -> None:
    ensure_goal_catalog()
    driver = get_driver()
    with driver.session() as session:
        session.run(
            """
            MERGE (u:User {id: $user_id})
            MATCH (g:Goal {id: $goal_id, catalog: true})
            MERGE (u)-[:HAS_GOAL]->(g)
            """,
            user_id=user_id,
            goal_id=goal_id,
        )


def unlink_user_goal(user_id: int, goal_id: int) -> None:
    _ensure_schema()
    driver = get_driver()
    with driver.session() as session:
        session.run(
            """
            MATCH (u:User {id: $user_id})-[r:HAS_GOAL]->(g:Goal {id: $goal_id})
            DELETE r
            """,
            user_id=user_id,
            goal_id=goal_id,
        )


def link_user_habit(user_id: int, habit_id: int, title: str) -> None:
    _ensure_schema()
    driver = get_driver()
    with driver.session() as session:
        session.run(
            """
            MERGE (u:User {id: $user_id})
            MERGE (h:Habit {id: $habit_id})
            SET h.title = $title
            MERGE (u)-[:HAS_HABIT]->(h)
            """,
            user_id=user_id,
            habit_id=habit_id,
            title=title,
        )


def add_friend(user_id: int, friend_user_id: int) -> None:
    _ensure_schema()
    driver = get_driver()
    with driver.session() as session:
        session.run(
            """
            MERGE (u:User {id: $user_id})
            MERGE (v:User {id: $friend_user_id})
            MERGE (u)-[:FRIEND]->(v)
            MERGE (v)-[:FRIEND]->(u)
            """,
            user_id=user_id,
            friend_user_id=friend_user_id,
        )


def list_friends(user_id: int) -> list[dict]:
    _ensure_schema()
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (u:User {id: $user_id})-[:FRIEND]->(f:User)
            RETURN f.id AS user_id, f.username AS username
            ORDER BY f.username ASC, f.id ASC
            """,
            user_id=user_id,
        )
        return [dict(r) for r in result]


def recommend_users(user_id: int, limit: int = 10) -> list[dict]:
    _ensure_schema()
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (me:User {id: $user_id})
            MATCH (other:User)
            WHERE other.id <> me.id AND NOT (me)-[:FRIEND]->(other)
            OPTIONAL MATCH (me)-[:HAS_GOAL]->(g:Goal)<-[:HAS_GOAL]-(other)
            OPTIONAL MATCH (me)-[:HAS_HABIT]->(h:Habit)<-[:HAS_HABIT]-(other)
            WITH other, count(DISTINCT g) AS shared_goals, count(DISTINCT h) AS shared_habits
            WITH other, shared_goals, shared_habits, (shared_goals + shared_habits) AS score
            WHERE score > 0
            RETURN other.id AS user_id, other.username AS username, shared_goals, shared_habits, score
            ORDER BY score DESC, user_id ASC
            LIMIT $limit
            """,
            user_id=user_id,
            limit=limit,
        )
        return [dict(r) for r in result]


def ensure_goal_catalog() -> None:
    _ensure_schema()
    driver = get_driver()
    with driver.session() as session:
        for goal in GOAL_CATALOG:
            session.run(
                """
                MERGE (g:Goal {id: $id})
                SET g.title = $title,
                    g.description = $description,
                    g.catalog = true
                """,
                id=goal["id"],
                title=goal["title"],
                description=goal.get("description"),
            )


def list_goal_catalog() -> list[dict]:
    ensure_goal_catalog()
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (g:Goal {catalog: true})
            RETURN g.id AS id, g.title AS title, g.description AS description
            ORDER BY g.id ASC
            """
        )
        return [dict(r) for r in result]


def clear_goal_graph() -> None:
    _ensure_schema()
    driver = get_driver()
    with driver.session() as session:
        session.run("MATCH ()-[r:HAS_GOAL]->() DELETE r")
        session.run("MATCH (g:Goal) DETACH DELETE g")
