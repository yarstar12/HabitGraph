# HabitGraph

HabitGraph — трекер привычек/здоровья с дневником, рекомендациями и социальным графом. Пользователь выбирает цель из каталога, создаёт привычки, отмечает выполнение (check‑in) и ведёт заметки. Система считает прогресс и streak, делает семантический поиск по дневнику и рекомендует людей с похожими целями через граф.

## Текущее состояние (готово)

- Backend (FastAPI) с PostgreSQL + MongoDB + Redis + Qdrant + Neo4j + (опционально) RabbitMQ.
- Frontend (React/Vite) с IA: Дашборд / Привычки / Цели / Дневник / Социальное / Настройки.
- Каталог целей в Neo4j, выбор цели из UI, рекомендации по общим целям/привычкам.
- Дневник с лентой и семантическим поиском, корректные loading/empty/error состояния.
- Demos/seed отключены по умолчанию, есть reset для очистки баз.

## Быстрый запуск (Docker)

Требуется: Docker + Docker Compose.

```bash
# Вариант A (remote zorin.space): подключиться к учебным БД
cp .env.example .env

docker compose up -d --build
```

- UI: `http://localhost:5173`
- API docs (Swagger): `http://localhost:8000/docs`

### Создание пользователя (обязательно)

Автосоздания пользователей нет — сначала создайте пользователя через API:

```bash
curl -s -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_user"}'
```

В ответе будет `id`. Его нужно использовать в заголовке `X-User-Id` для всех запросов.

Для тестов в UI:
- добавьте `VITE_DEBUG=true` в `frontend/.env` и пересоберите фронт
- в «Настройки» появится поле смены `user_id`

### Локальные БД (опционально)

Если хотите поднять **локальные контейнеры БД**, включите профиль `localdb` и поменяйте хосты/порты в `.env` на `localhost`/`5432/27017/6379/6333/7687` и т.д.:

```bash
docker compose --profile localdb up -d --build
```

## Цели (каталог)

Цели не создаются вручную. Пользователь выбирает цель из каталога (Neo4j):

- `GET /goals/catalog` — список целей
- `POST /goals` с `catalog_id` — выбрать цель
- `PATCH /goals/{id}` — архивировать/вернуть цель

Связь в графе: `(User)-[:HAS_GOAL]->(Goal)`

## Очистка данных

Полный сброс всех БД:

```bash
docker compose --profile tools run --rm reset
```

Только цели (PostgreSQL + Neo4j каталог/связи):

```bash
docker compose --profile tools run --rm --build backend python -m app.scripts.reset_goals
```

## Демо‑данные (опционально)

По умолчанию демо‑данные **не загружаются**. Для загрузки:

```bash
SEED_DEMO=1 docker compose --profile tools run --rm seed
```

## Сценарии пользователя

- Создать пользователя и выбрать цель из каталога.
- Создать привычки, отмечать выполнение, смотреть прогресс и streak.
- Вести дневник и искать похожие записи по смыслу.
- Смотреть рекомендации людей с похожими целями/привычками и добавлять друзей.

## Архитектура (высокий уровень)

- Frontend: React/Vite (SPA).
- Backend: FastAPI (монолит на старте) + фоновые воркеры.
- Хранилища: PostgreSQL + MongoDB + Redis + Qdrant + Neo4j.

```
            ┌──────────────────┐
            │   Web / Mobile   │
            └─────────┬────────┘
                      v
            ┌──────────────────┐
            │    API Backend   │
            └───┬──────┬───┬───┘
                │      │   │
                │      │   └────────> Redis (cache/counters/sessions)
                │      └────────────> MongoDB (diary_entries)
                └───────────────────> PostgreSQL (users/habits/checkins/goals)
                      │
                      v
                 RabbitMQ (events/queues)
                      │
                      v
            ┌──────────────────┐
            │   Workers (async)│
            └──────┬──────┬────┘
                   │      │
                   v      v
               Qdrant    Neo4j
           (vector search) (social/goal graph)
```

## Why these DBs

### PostgreSQL (источник истины)

- Основные сущности: `users`, `habits`, `goals` (выбранные цели с `catalog_id`), `checkins`.
- Транзакции и ограничения (например, уникальность check-in на день/привычку).
- SQL‑агрегации для отчётов и дашборда.

### MongoDB (гибкий дневник)

- `diary_entries`: свободный текст, теги, настроение, произвольные метаданные.
- Удобно расширять структуру записей без тяжёлых миграций.

### Redis (быстрое состояние и кеш)

- Streak counters и быстрые ключи для дашборда.
- Cache для часто читаемых сводок/виджетов.

### Qdrant (семантический поиск)

- Векторы дневниковых записей для поиска «по смыслу».
- Быстрый top‑k поиск похожих записей.

### Neo4j (социальный граф и каталог целей)

- Каталог целей: `Goal` с `catalog=true`.
- Связи: `User` ↔ `Goal` (HAS_GOAL) и `User` ↔ `User` (FRIEND).
- Рекомендации по общим целям/привычкам.

## Где встанет RabbitMQ

RabbitMQ — шина событий между API и воркерами для асинхронных задач:

- `diary.entry.created/updated` → эмбеддинг и обновление Qdrant.
- `habits.checkin.recorded` → пересчёт агрегатов и кешей.
- `user.goals.changed` → пересчёт рекомендаций.
- `notifications.schedule` / `reports.generate` → напоминания и отчёты.

## Минимальные API endpoints

- `POST /users`, `GET /users`, `GET /users/me`, `PATCH /users/me`, `GET /users/search`
- `GET /goals/catalog`, `POST /goals`, `GET /goals`, `PATCH /goals/{id}`
- `POST /habits`, `GET /habits`, `PATCH /habits/{id}`
- `POST /checkins`
- `GET /dashboard/summary`, `GET /overview`
- `POST /diary`, `GET /diary` (pagination), `PATCH /diary/{id}`, `DELETE /diary/{id}`
- `GET /diary/similar`
- `GET /social/friends`, `GET /social/recommendations`, `POST /social/friends`
