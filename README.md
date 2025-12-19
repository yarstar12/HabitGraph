# HabitGraph

HabitGraph — трекер привычек/здоровья с дневником, рекомендациями и социальным графом. Пользователь создаёт привычки и цели, отмечает выполнение (check-in) и ведёт заметки. Система считает прогресс и streak, делает семантический поиск по дневнику и рекомендует людей с похожими целями через граф.

## Текущее состояние (что есть)

- Backend (FastAPI) с PostgreSQL + MongoDB + Redis + Qdrant + Neo4j + (опционально) RabbitMQ.
- Эндпоинты: habits/goals/checkins/dashboard/summary/diary/diary/similar/social/friends/social/recommendations/users/me/users/search/health.
- Redis считает streak, Qdrant хранит вектора дневника, Neo4j — соц-граф и рекомендации, RabbitMQ — хук для событий (если поднимешь).
- Frontend (React/Vite) с полноценной IA: Дашборд / Привычки / Цели / Дневник / Социальное / Настройки. Онбординг‑чеклист на дашборде, нормальные empty/loading/error состояния.
- Сидер по умолчанию выключен; reset для очистки всех БД есть.

## Быстрый запуск (Docker)

Требуется: Docker + Docker Compose.

```bash
# Вариант A (remote zorin.space): подключаться к учебному серверу (локальные контейнеры БД не нужны)
cp .env.example .env

# поднять сервисы приложения (backend + frontend)
docker compose up -d --build
```

- UI: `http://localhost:5173`
- API docs (Swagger): `http://localhost:8000/docs`
- Demo user: передавайте заголовок `X-User-Id` (по умолчанию `1`)

### Локальные БД (опционально)

Если хотите поднять **локальные контейнеры БД**, включите профиль `localdb` и поменяйте хосты/порты в `.env` на `localhost`/`5432/27017/6379/6333/7687` и т.д.:

```bash
docker compose --profile localdb up -d --build
```

## Очистка данных

Если ты уже запускал сидер или хочешь начать “с чистого листа”, запусти сброс:

```bash
docker compose --profile tools run --rm reset
```

## Демо-данные (опционально)

По умолчанию демо‑данные **не загружаются**. Для загрузки:

```bash
SEED_DEMO=1 docker compose --profile tools run --rm seed
```

### RabbitMQ (опционально)

RabbitMQ подключается как “extras” профиль:

```bash
docker compose --profile extras up -d rabbitmq
```

## Сценарии пользователя

- Задать пользователя (в UI — поле `user_id` в шапке; в API — заголовок `X-User-Id`).
- Создать привычки/цели и отмечать check-in; видеть дашборд + streak (Redis).
- Вести дневник (MongoDB) и искать похожие записи по смыслу (Qdrant).
- Смотреть рекомендации пользователей с похожими целями/привычками (Neo4j) и добавлять друзей.
- Получать обзор /next step: `GET /overview`.

## Архитектура (высокий уровень)

- Frontend: Web (SPA/Next.js/React — уточним позже).
- Backend: API (монолит на старте) + фоновые воркеры.
- Хранилища: PostgreSQL + MongoDB + Redis + Qdrant + Neo4j.

```
            ┌──────────────────┐
            │   Web/Mobile UI  │
            └─────────┬────────┘
                      v
            ┌──────────────────┐
            │    API Backend   │
            └───┬──────┬───┬───┘
                │      │   │
                │      │   └────────> Redis (cache/counters/sessions)
                │      └────────────> MongoDB (diary_entries)
                └───────────────────> PostgreSQL (users/habits/checkins/analytics)
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

- Основные сущности и связи: `users`, `habits`, `goals`, `schedules`, `checkins`.
- Транзакции и ограничения (например, уникальность check-in на день/привычку).
- SQL-агрегации для отчётов и дашборда (неделя/месяц, прогресс, streak history).

### MongoDB (гибкий дневник)

- `diary_entries`: свободный текст, теги, настроение, произвольные метаданные (сон/питание/самочувствие и т.п.).
- Удобно расширять структуру записей без тяжёлых миграций на раннем этапе.
- Хранит “сырой” контент, из которого строятся эмбеддинги для Qdrant.

### Redis (быстрое состояние и кеш)

- Streak counters и быстрые ключи для дашборда (последний check-in, текущая серия).
- Cache для часто читаемых сводок/виджетов.
- (Опционально) sessions, rate-limit, idempotency для защиты от дублей check-in.

### Qdrant (семантический поиск и рекомендации)

- Векторное хранилище эмбеддингов `diary_entries` и/или “карточек советов”.
- Поиск похожих записей/контекста по смыслу (top-k nearest neighbors).
- Основа для рекомендаций “похожие записи/советы” и подсказок.

### Neo4j (социальный граф)

- Граф: `User` ↔ `User` (FRIEND/FOLLOW), `User` ↔ `Goal/Habit` (HAS_GOAL/HAS_HABIT).
- Рекомендации “люди с похожими целями”, “friends-of-friends”, общие привычки.
- Удобно объяснять рекомендации (“у вас 3 общие цели”).

## Где встанет RabbitMQ в среду

RabbitMQ — шина событий между API и воркерами для долгих/асинхронных задач:

- `diary.entry.created/updated` → посчитать эмбеддинг и обновить Qdrant.
- `habits.checkin.recorded` → пересчитать агрегаты/обновить кеши и счётчики (Redis), подготовить отчёт.
- `user.goals.changed` → пересчитать рекомендации (Neo4j/Qdrant).
- `notifications.schedule` / `reports.generate` → напоминания и периодические отчёты (канал оповещений — позже).

## MVP на 1 неделю

- PostgreSQL: регистрация/логин (минимально), CRUD привычек/целей, check-in на день.
- Redis: подсчёт streak + кеш простой сводки для дашборда.
- MongoDB: CRUD дневника (`diary_entries`) и фильтры по тегам/дате.
- Qdrant: загрузка эмбеддингов для записей дневника и простой semantic search (похожие записи).
- Neo4j: базовый соц-граф (добавить друга/подписку) и рекомендация “люди с общими целями”.
- RabbitMQ: зафиксировать события/очереди для воркеров (реализация воркеров — следующий этап).

## Минимальные API endpoints

- `POST /habits`, `GET /habits`
- `PATCH /habits/{id}`
- `POST /goals`, `GET /goals`
- `PATCH /goals/{id}`
- `POST /checkins`
- `GET /dashboard`
- `GET /dashboard/summary`
- `GET /overview`
- `POST /diary`, `GET /diary` (pagination)
- `PATCH /diary/{id}`, `DELETE /diary/{id}`
- `GET /diary/similar`
- `GET /social/friends`, `GET /social/recommendations`, `POST /social/friends`
- `GET /users/me`, `PATCH /users/me`, `GET /users/search`
