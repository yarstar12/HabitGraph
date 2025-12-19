import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, DashboardSummary, TodayHabit } from "../api";
import { EmptyState, ErrorState, LoadingGrid, SectionHeader } from "../components/States";
import { Modal } from "../components/Modal";
import { useToast } from "../context/ToastContext";
import { useUser } from "../context/UserContext";
import { useOnboarding } from "../context/OnboardingContext";

export default function DashboardPage() {
  const { userId } = useUser();
  const toast = useToast();
  const { completed } = useOnboarding();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkinOpen, setCheckinOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.dashboard.summary(userId);
      setSummary(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [userId]);

  const progress = useMemo(() => {
    if (!summary || summary.today_total === 0) return 0;
    return Math.round((summary.today_done / summary.today_total) * 100);
  }, [summary]);

  const checklist = useMemo(() => {
    if (!summary) return [];
    return [
      {
        id: "habit",
        title: "Создай привычку",
        done: summary.habits_count > 0,
        to: "/habits"
      },
      {
        id: "checkin",
        title: "Отметь выполнение",
        done: summary.today_done > 0,
        to: "/"
      },
      {
        id: "diary",
        title: "Добавь запись в дневник",
        done: summary.diary_entries > 0,
        to: "/diary"
      },
      {
        id: "semantic",
        title: "Найди похожие записи",
        done: completed.semantic_search,
        to: "/diary"
      },
      {
        id: "social",
        title: "Посмотри рекомендации людей",
        done: completed.social_viewed,
        to: "/social"
      }
    ];
  }, [summary, completed]);

  const checklistProgress = checklist.filter((i) => i.done).length;
  const checklistLabel = checklist.length > 0 ? `${checklistProgress}/${checklist.length}` : "—";

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <p className="eyebrow">Сегодня</p>
          <h1>Добро пожаловать в HabitGraph</h1>
          <p className="muted">
            Сервис помогает держать фокус: привычки, дневник и поддержка сообщества — в одном месте.
          </p>
        </div>
        <div className="hero-card">
          <div className="hero-metric">
            <div className="muted">Сегодня выполнено</div>
            <div className="metric">
              {summary ? `${summary.today_done}/${summary.today_total}` : "—"}
            </div>
          </div>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <button className="btn primary" onClick={() => setCheckinOpen(true)}>
            Отметить выполнение
          </button>
        </div>
      </section>

      <section className="stack">
        <SectionHeader title="Сегодня" subtitle="Отметь привычки, которые сделал" />
        {loading && <LoadingGrid count={3} />}
        {error && <ErrorState message={error} onRetry={refresh} />}
        {!loading && summary && summary.habits_today.length === 0 && (
          <EmptyState
            title="Пока нет привычек"
            description="Создай первую привычку, чтобы видеть список на сегодня."
            action={<Link className="btn ghost" to="/habits">Создать привычку</Link>}
          />
        )}
        {!loading && summary && summary.habits_today.length > 0 && (
          <div className="grid">
            {summary.habits_today.map((h) => (
              <TodayHabitCard key={h.habit_id} habit={h} onDone={refresh} />
            ))}
          </div>
        )}
      </section>

      <section className="grid-2">
        <div className="card">
          <SectionHeader title="Прогресс" subtitle="Активность за 7 дней" />
          {summary ? <WeekChart points={summary.week_activity} /> : <div className="skeleton" />}
          <div className="metric-row">
            <div>
              <div className="muted">Суммарная серия</div>
              <div className="metric">{summary ? summary.streak_total : "—"}</div>
            </div>
            <div>
              <div className="muted">Привычек</div>
              <div className="metric">{summary ? summary.habits_count : "—"}</div>
            </div>
            <div>
              <div className="muted">Целей</div>
              <div className="metric">{summary ? summary.goals_count : "—"}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <SectionHeader
            title="Первые шаги"
            subtitle={`Прогресс: ${checklistLabel}`}
          />
          <div className="checklist">
            {checklist.map((item) => (
              <Link key={item.id} className={`check-item ${item.done ? "done" : ""}`} to={item.to}>
                <span className="check-bullet">{item.done ? "✓" : "•"}</span>
                <span>{item.title}</span>
              </Link>
            ))}
          </div>
          <div className="muted tiny">Каждый шаг помогает сервису точнее подсказывать тебе.</div>
        </div>
      </section>

      <Modal open={checkinOpen} title="Отметить выполнение" onClose={() => setCheckinOpen(false)}>
        {summary && summary.habits_today.length > 0 ? (
          <div className="stack">
            {summary.habits_today.map((h) => (
              <CheckinRow key={h.habit_id} habit={h} onDone={async () => {
                await markDone(userId, h.habit_id, toast);
                await refresh();
                setCheckinOpen(false);
              }} />
            ))}
          </div>
        ) : (
          <EmptyState title="Пока нечего отмечать" description="Создай первую привычку." />
        )}
      </Modal>
    </div>
  );
}

function TodayHabitCard({ habit, onDone }: { habit: TodayHabit; onDone: () => void }) {
  const { userId } = useUser();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function handleDone() {
    if (habit.done) return;
    setSaving(true);
    try {
      await markDone(userId, habit.habit_id, toast);
      onDone();
    } catch (e) {
      toast.push({ type: "error", title: "Не удалось отметить", description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card habit-card">
      <div>
        <div className="title">{habit.title}</div>
        <div className="muted">Сегодня</div>
      </div>
      <button className={`btn ${habit.done ? "success" : "primary"}`} onClick={handleDone} disabled={saving}>
        {habit.done ? "Готово" : "Сделано"}
      </button>
    </div>
  );
}

function WeekChart({ points }: { points: { date: string; count: number }[] }) {
  const max = Math.max(...points.map((p) => p.count), 1);
  return (
    <div className="week-chart">
      {points.map((p) => (
        <div key={p.date} className="week-bar">
          <div className="week-fill" style={{ height: `${(p.count / max) * 100}%` }} />
          <span className="tiny">{new Date(p.date).getDate()}</span>
        </div>
      ))}
    </div>
  );
}

async function markDone(userId: number, habitId: number, toast: { push: (t: any) => void }) {
  await api.checkins.create(userId, habitId);
  toast.push({ type: "success", title: "Отлично!", description: "Привычка отмечена." });
}

function CheckinRow({ habit, onDone }: { habit: TodayHabit; onDone: () => void }) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="row-between">
      <div>
        <div className="title">{habit.title}</div>
        <div className="muted">{habit.done ? "Уже отмечено сегодня" : "Можно отметить сейчас"}</div>
      </div>
      <button className="btn primary" disabled={habit.done || loading} onClick={async () => {
        setLoading(true);
        await onDone();
        setLoading(false);
      }}>
        {habit.done ? "Готово" : "Отметить"}
      </button>
    </div>
  );
}
