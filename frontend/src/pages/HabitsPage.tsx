import { useEffect, useMemo, useState } from "react";
import { api, Goal, Habit } from "../api";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorState, LoadingGrid, SectionHeader } from "../components/States";
import { useToast } from "../context/ToastContext";
import { useUser } from "../context/UserContext";

const frequencies = [
  { value: "", label: "Без расписания" },
  { value: "daily", label: "Ежедневно" },
  { value: "weekdays", label: "По будням" },
  { value: "weekly", label: "Раз в неделю" }
];

export default function HabitsPage() {
  const { userId } = useUser();
  const toast = useToast();
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [habits, setHabits] = useState<Habit[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [habitsData, goalsData] = await Promise.all([
        api.habits.list(userId, status),
        api.goals.list(userId, "active")
      ]);
      setHabits(habitsData);
      setGoals(goalsData);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [userId, status]);

  const goalsById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  async function handleArchive(habit: Habit, next: boolean) {
    try {
      await api.habits.update(userId, habit.id, { is_archived: next });
      toast.push({ type: "success", title: next ? "Привычка архивирована" : "Привычка возвращена" });
      await refresh();
    } catch (e) {
      toast.push({ type: "error", title: "Не удалось сохранить", description: (e as Error).message });
    }
  }

  return (
    <div className="stack">
      <SectionHeader
        title="Привычки"
        subtitle="Создавай привычки и отмечай выполнение каждый день."
        action={
          <button className="btn primary" onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}>
            Создать привычку
          </button>
        }
      />

      <div className="tabs">
        <button className={`tab ${status === "active" ? "active" : ""}`} onClick={() => setStatus("active")}>
          Активные
        </button>
        <button className={`tab ${status === "archived" ? "active" : ""}`} onClick={() => setStatus("archived")}>
          Архив
        </button>
      </div>

      {loading && <LoadingGrid count={4} />}
      {error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && habits.length === 0 && (
        <EmptyState
          title={status === "active" ? "У вас нет привычек" : "Архив пока пуст"}
          description={status === "active" ? "Создайте первую привычку, чтобы начать путь." : "Верните привычку из архива или создайте новую."}
          action={
            status === "active" ? (
              <button className="btn primary" onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}>
                Создать привычку
              </button>
            ) : null
          }
        />
      )}

      {!loading && habits.length > 0 && (
        <div className="grid">
          {habits.map((habit) => (
            <div key={habit.id} className="card habit-card">
              <div>
                <div className="title">{habit.title}</div>
                <div className="muted">
                  {habit.frequency ? frequencies.find((f) => f.value === habit.frequency)?.label : "Без расписания"}
                </div>
                {habit.goal_id && goalsById.get(habit.goal_id) && (
                  <div className="chip">Цель: {goalsById.get(habit.goal_id)?.title}</div>
                )}
              </div>
              <div className="stack">
                <button
                  className="btn ghost"
                  onClick={() => {
                    setEditing(habit);
                    setModalOpen(true);
                  }}
                >
                  Редактировать
                </button>
                <button
                  className={`btn ${habit.is_archived ? "ghost" : "ghost"}`}
                  onClick={() => handleArchive(habit, !habit.is_archived)}
                >
                  {habit.is_archived ? "Вернуть" : "В архив"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} title={editing ? "Редактирование привычки" : "Новая привычка"} onClose={() => setModalOpen(false)}>
        <HabitForm
          goals={goals}
          initial={editing}
          onCancel={() => setModalOpen(false)}
          onSave={async (payload) => {
            try {
              if (editing) {
                await api.habits.update(userId, editing.id, payload);
                toast.push({ type: "success", title: "Привычка обновлена" });
              } else {
                await api.habits.create(userId, payload);
                toast.push({ type: "success", title: "Привычка создана" });
              }
              setModalOpen(false);
              await refresh();
            } catch (e) {
              toast.push({ type: "error", title: "Не удалось сохранить", description: (e as Error).message });
            }
          }}
        />
      </Modal>
    </div>
  );
}

function HabitForm({
  goals,
  initial,
  onSave,
  onCancel
}: {
  goals: Goal[];
  initial: Habit | null;
  onSave: (payload: Partial<Habit>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "");
  const [targetValue, setTargetValue] = useState(initial?.target_value?.toString() ?? "");
  const [targetUnit, setTargetUnit] = useState(initial?.target_unit ?? "раз");
  const [reminderTime, setReminderTime] = useState(initial?.reminder_time ?? "");
  const [goalId, setGoalId] = useState(initial?.goal_id?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) {
          setError("Название не может быть пустым");
          return;
        }
        setError(null);
        onSave({
          title: title.trim(),
          frequency: frequency || null,
          target_value: targetValue ? Number(targetValue) : null,
          target_unit: targetValue ? targetUnit || null : null,
          reminder_time: reminderTime || null,
          goal_id: goalId ? Number(goalId) : null
        });
      }}
    >
      {error && <div className="error">{error}</div>}
      <label className="field">
        <span>Название</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, 10 000 шагов" />
      </label>
      <label className="field">
        <span>Частота</span>
        <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
          {frequencies.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        <label className="field">
          <span>Цель/норма</span>
          <input
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="Например, 10"
            type="number"
            min={1}
          />
        </label>
        <label className="field">
          <span>Единица</span>
          <input value={targetUnit} onChange={(e) => setTargetUnit(e.target.value)} placeholder="раз" />
        </label>
      </div>
      <label className="field">
        <span>Напоминание (опц.)</span>
        <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
      </label>
      <label className="field">
        <span>Привязка к цели (опц.)</span>
        <select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
          <option value="">Без цели</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </select>
      </label>
      <div className="row-between">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="btn primary">
          Сохранить
        </button>
      </div>
    </form>
  );
}
