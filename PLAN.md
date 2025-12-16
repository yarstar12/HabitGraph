# HabitGraph — Implementation Plan

Цель: учебный демо‑проект “HabitGraph” с минимальным, но рабочим end‑to‑end: Docker Compose поднимает все требуемые БД, Backend API использует каждую БД “по делу”, Frontend показывает 2–3 экрана.

## Репо‑структура

```
.
├─ backend/              # FastAPI + интеграции БД + seed
├─ frontend/             # React/Vite демо‑UI
├─ infra/                # вспомогательные файлы (init, примеры, заметки)
├─ docker-compose.yml    # Postgres/Mongo/Redis/Qdrant/Neo4j (+ RabbitMQ optional)
└─ README.md             # как запустить и что где хранится
```

## Архитектура (вкратце)

- Backend: FastAPI (монолит) + простые clients для Postgres/Mongo/Redis/Qdrant/Neo4j.
- Async задачи (RabbitMQ): события публикуются из API, воркер — placeholder (без сложной реализации).
- Auth упрощён: `X-User-Id` (demo), чтобы не тратить время на полноценную аутентификацию.

## Назначение БД (обязательная часть)

- PostgreSQL: users/habits/goals/checkins + простые агрегаты для dashboard.
- MongoDB: `diary_entries` (гибкие поля, метаданные).
- Redis: счётчики streak + cache для dashboard.
- Qdrant: вектора `diary_entries` для semantic search (`/diary/similar`).
- Neo4j: social graph (friends/follows) + рекомендации пользователей по общим целям/привычкам.

## Минимальные API‑эндпоинты

- `POST /habits`, `GET /habits`
- `POST /goals`, `GET /goals`
- `POST /checkins`
- `GET /dashboard`
- `POST /diary`, `GET /diary`
- `GET /diary/similar`
- `GET /social/recommendations` (+ опционально `POST /social/friends`)

## Порядок реализации (с частыми коммитами)

1. Compose для БД + env examples.
2. FastAPI skeleton + healthcheck.
3. PostgreSQL модели и эндпоинты habits/goals/checkins/dashboard.
4. Mongo diary endpoints.
5. Qdrant: embedding (deterministic) + upsert/search.
6. Neo4j: nodes/relationships + recommendations query.
7. RabbitMQ: publisher hook (optional, graceful fallback).
8. Seed script: заполнить все БД демо‑данными.
9. Frontend: Dashboard / Diary / Social (fetch к API).
10. README: quickstart (docker compose up + seed + открыть UI).

