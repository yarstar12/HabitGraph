import { useEffect, useMemo, useState } from "react";
import { api, DashboardHabit, Habit } from "../api";

export default function DashboardPage() {
  const [habits, setHabits] = useState<DashboardHabit[]>([]);
  const [allHabits, setAllHabits] = useState<Habit[]>([]);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalStreak = useMemo(() => habits.reduce((acc, h) => acc + (h.streak ?? 0), 0), [habits]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const dash = await api.dashboard.get();
      setHabits(dash.habits);
      setAllHabits(await api.habits.list());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreateHabit() {
    if (!newHabitTitle.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.habits.create(newHabitTitle.trim());
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
      await api.checkins.create(habitId);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <h1>Дашборд</h1>

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

      <details className="card">
        <summary>Сырые данные (habits)</summary>
        <pre className="pre">{JSON.stringify(allHabits, null, 2)}</pre>
      </details>
    </div>
  );
}
