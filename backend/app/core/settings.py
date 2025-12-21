from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    allow_origins: str = "http://localhost:5173"

    student_name: str | None = None
    db_host: str = "localhost"

    postgres_host: str | None = None
    postgres_port: int = 5432
    postgres_user: str = "habitgraph"
    postgres_password: str = "habitgraph"
    postgres_db: str = "habitgraph"
    postgres_dsn: str | None = None

    mongo_host: str | None = None
    mongo_port: int = 27017
    mongo_user: str = "root"
    mongo_password: str = "secret"
    mongo_db: str = "habitgraph"
    mongo_uri: str | None = None

    redis_host: str | None = None
    redis_port: int = 6379
    redis_db: int = 0
    redis_url: str | None = None

    qdrant_host: str | None = None
    qdrant_port: int = 6333
    qdrant_collection: str = "habitgraph_diary_entries"
    qdrant_url: str | None = None

    neo4j_host: str | None = None
    neo4j_port: int = 7687
    neo4j_user: str = "neo4j"
    neo4j_password: str = "habitgraph"
    neo4j_uri: str | None = None

    rabbitmq_host: str | None = None
    rabbitmq_port: int = 5672
    rabbitmq_user: str = "guest"
    rabbitmq_password: str = "guest"
    rabbitmq_url: str | None = None

    def _slug(self, value: str) -> str:
        out = []
        for ch in value.strip():
            if ch.isalnum():
                out.append(ch.lower())
            else:
                out.append("_")
        s = "".join(out)
        while "__" in s:
            s = s.replace("__", "_")
        return s.strip("_")

    def default_student_db_name(self) -> str | None:
        if not self.student_name:
            return None
        return f"appdb_habitgraph_{self._slug(self.student_name)}"

    def effective_postgres_db(self) -> str:
        if self.postgres_db != "habitgraph":
            return self.postgres_db
        derived = self.default_student_db_name()
        return derived or self.postgres_db

    def effective_mongo_db(self) -> str:
        if self.mongo_db != "habitgraph":
            return self.mongo_db
        derived = self.default_student_db_name()
        return derived or self.mongo_db

    def postgres_sqlalchemy_dsn(self) -> str:
        if self.postgres_dsn:
            return self.postgres_dsn
        host = self.postgres_host or self.db_host
        return f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}@{host}:{self.postgres_port}/{self.effective_postgres_db()}"

    def mongo_url(self) -> str:
        if self.mongo_uri:
            return self.mongo_uri
        host = self.mongo_host or self.db_host
        return f"mongodb://{self.mongo_user}:{self.mongo_password}@{host}:{self.mongo_port}/?authSource=admin"

    def redis_connection_url(self) -> str:
        if self.redis_url:
            return self.redis_url
        host = self.redis_host or self.db_host
        return f"redis://{host}:{self.redis_port}/{self.redis_db}"

    def qdrant_connection(self) -> tuple[str, int]:
        if self.qdrant_url and self.qdrant_url.startswith(("http://", "https://")):
            stripped = self.qdrant_url.split("://", 1)[1]
            host_port = stripped.split("/", 1)[0]
            if ":" in host_port:
                h, p = host_port.split(":", 1)
                return h, int(p)
            return host_port, 6333
        host = self.qdrant_host or self.db_host
        return host, self.qdrant_port

    def effective_qdrant_collection(self) -> str:
        if self.qdrant_collection != "habitgraph_diary_entries":
            return self.qdrant_collection
        derived = self.default_student_db_name()
        return derived or self.qdrant_collection

    def fallback_qdrant_collection(self) -> str | None:
        if not self.student_name:
            return None
        return f"appdb_{self.student_name}"

    def neo4j_bolt_uri(self) -> str:
        if self.neo4j_uri:
            return self.neo4j_uri
        host = self.neo4j_host or self.db_host
        return f"bolt://{host}:{self.neo4j_port}"

    def rabbitmq_amqp_url(self) -> str | None:
        if self.rabbitmq_url:
            return self.rabbitmq_url
        if not self.rabbitmq_host:
            return None
        host = self.rabbitmq_host
        return f"amqp://{self.rabbitmq_user}:{self.rabbitmq_password}@{host}:{self.rabbitmq_port}/"


settings = Settings()
