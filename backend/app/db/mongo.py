from pymongo import MongoClient

from app.core.settings import settings

_client: MongoClient | None = None


def get_mongo_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(settings.mongo_uri)
    return _client


def get_diary_collection():
    client = get_mongo_client()
    db = client[settings.mongo_db]
    return db["diary_entries"]

