import { useEffect, useMemo, useState } from "react";
import { api, DashboardHabit, Habit, Overview } from "../api";
import { useUser } from "../context/UserContext";

export default function DashboardPage() {
  const { userId } = useUser();
  const [habits, setHabits] = useState<DashboardHabit[]>([]);
  const [allHabits, setAllHabits] = useState<Habit[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalStreak = useMemo(() => habits.reduce((acc, h) => acc + (h.streak ?? 0), 0), [habits]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const dash = await api.dashboard.get(userId);
      setHabits(dash.habits);
      setAllHabits(await api.habits.list(userId));
      setOverview(await api.overview.get(userId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [userId]);

  async function onCreateHabit() {
    if (!newHabitTitle.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.habits.create(userId, newHabitTitle.trim());
      setNewHabitTitle("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onCheckin(habitId: number) {
    setLoading(true);
    setError(null);
    try {
      await api.checkins.create(userId, habitId);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <div className="hero">
        <div>
          <p className="eyebrow">Твой путь</p>
          <h1>Дашборд HabitGraph</h1>
          <p className="muted">
            Отслеживай привычки, streak, дневник и рекомендации. Заполняй данные — сервис подхватит всё автоматически.
          </p>
        </div>
        <div className="hero-actions">
          <div className="chip accent">user_id: {userId}</div>
          <div className="muted tiny">Меняется вверху справа</div>
        </div>
      </div>

      {overview && (
        <div className="stats-grid">
          <StatCard label="Привычки" value={overview.habits_count} hint="Сколько привычек у пользователя" />
          <StatCard label="Цели" value={overview.goals_count} hint="Цели для ориентира" />
          <StatCard label="Записей в дневнике" value={overview.diary_entries} hint="Для семантического поиска" />
          <StatCard label="Отметок за 7 дней" value={overview.checkins_last_7_days} hint="Частота активности" />
          <StatCard label="Сумма серий" value={overview.streak_total} hint="Суммарные streak по привычкам" />
          <TipsCard tips={overview.tips} />
        </div>
      )}

      <div className="card">
        <div className="row">
          <input
            value={newHabitTitle}
            onChange={(e) => setNewHabitTitle(e.target.value)}
            placeholder="Название новой привычки"
          />
          <button onClick={onCreateHabit} disabled={loading}>
            Добавить
          </button>
        </div>
        <div className="muted">Сумма серий (streak): {totalStreak}</div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid">
        {habits.map((h) => (
          <div key={h.habit_id} className="card">
            <div className="title">{h.title}</div>
            <div className="muted">
              серия: <b>{h.streak}</b> · отметок: <b>{h.total_checkins}</b>
            </div>
            <div className="muted">последняя: {h.last_checkin ?? "—"}</div>
            <button onClick={() => onCheckin(h.habit_id)} disabled={loading}>
              Отметить сегодня
            </button>
          </div>
        ))}
        {!habits.length && !loading && (
          <div className="card muted">Пока нет привычек. Создай первую выше.</div>
        )}
      </div>

      <div className="card tips">
        <div className="title">Как использовать HabitGraph</div>
        <ul>
          <li>Создай привычку, затем отмечай ежедневные check-in.</li>
          <li>Пиши в дневник — по записям будет работать семантический поиск.</li>
          <li>Добавь друзей в соцграф и посмотри рекомендации по общим целям.</li>
        </ul>
        <details>
          <summary>Сырые данные (habits)</summary>
          <pre className="pre">{JSON.stringify(allHabits, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card stat">
      <div className="muted tiny">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="muted tiny">{hint}</div>}
    </div>
  );
}

function TipsCard({ tips }: { tips: string[] }) {
  if (!tips.length) {
    return (
      <div className="card stat">
        <div className="muted tiny">Следующий шаг</div>
        <div className="stat-value">Все готово</div>
        <div className="muted tiny">Продолжай заполнять данные.</div>
      </div>
    );
  }
  return (
    <div className="card stat">
      <div className="muted tiny">Следующий шаг</div>
      <ul className="tip-list">
        {tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
