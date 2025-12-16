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
      <h1>Dashboard</h1>

      <div className="card">
        <div className="row">
          <input
            value={newHabitTitle}
            onChange={(e) => setNewHabitTitle(e.target.value)}
            placeholder="New habit title"
          />
          <button onClick={onCreateHabit} disabled={loading}>
            Add habit
          </button>
        </div>
        <div className="muted">Total streak sum: {totalStreak}</div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid">
        {habits.map((h) => (
          <div key={h.habit_id} className="card">
            <div className="title">{h.title}</div>
            <div className="muted">
              streak: <b>{h.streak}</b> · check-ins: <b>{h.total_checkins}</b>
            </div>
            <div className="muted">last: {h.last_checkin ?? "—"}</div>
            <button onClick={() => onCheckin(h.habit_id)} disabled={loading}>
              Check-in today
            </button>
          </div>
        ))}
        {!habits.length && !loading && (
          <div className="card muted">No habits yet. Create one above.</div>
        )}
      </div>

      <details className="card">
        <summary>Raw habits</summary>
        <pre className="pre">{JSON.stringify(allHabits, null, 2)}</pre>
      </details>
    </div>
  );
}

