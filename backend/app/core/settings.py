from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    allow_origins: str = "http://localhost:5173"

    postgres_dsn: str = "postgresql+psycopg2://habitgraph:habitgraph@localhost:5432/habitgraph"
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "habitgraph"
    redis_url: str = "redis://localhost:6379/0"
    qdrant_url: str = "http://localhost:6333"
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "habitgraph"

    rabbitmq_url: str | None = None


settings = Settings()

