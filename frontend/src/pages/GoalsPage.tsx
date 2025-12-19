import { useEffect, useState } from "react";
import { api, Goal, Habit } from "../api";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorState, LoadingGrid, SectionHeader } from "../components/States";
import { useToast } from "../context/ToastContext";
import { useUser } from "../context/UserContext";

export default function GoalsPage() {
  const { userId } = useUser();
  const toast = useToast();
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [goalsData, habitsData] = await Promise.all([
        api.goals.list(userId, status),
        api.habits.list(userId, "all")
      ]);
      setGoals(goalsData);
      setHabits(habitsData);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [userId, status]);

  const habitsByGoal = habits.reduce<Record<number, number>>((acc, h) => {
    if (h.goal_id) acc[h.goal_id] = (acc[h.goal_id] ?? 0) + 1;
    return acc;
  }, {});

  async function handleArchive(goal: Goal, next: boolean) {
    try {
      await api.goals.update(userId, goal.id, { is_archived: next });
      toast.push({ type: "success", title: next ? "Цель в архиве" : "Цель восстановлена" });
      await refresh();
    } catch (e) {
      toast.push({ type: "error", title: "Не удалось сохранить", description: (e as Error).message });
    }
  }

  return (
    <div className="stack">
      <SectionHeader
        title="Цели"
        subtitle="Добавляй цели и связывай с привычками."
        action={
          <button className="btn primary" onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}>
            Создать цель
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

      {loading && <LoadingGrid count={3} />}
      {error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && goals.length === 0 && (
        <EmptyState
          title={status === "active" ? "У вас нет целей" : "Архив пока пуст"}
          description={status === "active" ? "Создайте цель — это поможет удерживать фокус." : "Верните цель из архива или создайте новую."}
          action={
            status === "active" ? (
              <button className="btn primary" onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}>
                Создать цель
              </button>
            ) : null
          }
        />
      )}

      {!loading && goals.length > 0 && (
        <div className="grid">
          {goals.map((goal) => (
            <div key={goal.id} className="card">
              <div className="title">{goal.title}</div>
              <div className="muted">{goal.description || "Описание пока не добавлено"}</div>
              <div className="chip">Связанных привычек: {habitsByGoal[goal.id] ?? 0}</div>
              <div className="row">
                <button
                  className="btn ghost"
                  onClick={() => {
                    setEditing(goal);
                    setModalOpen(true);
                  }}
                >
                  Редактировать
                </button>
                <button className="btn ghost" onClick={() => handleArchive(goal, !goal.is_archived)}>
                  {goal.is_archived ? "Вернуть" : "В архив"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} title={editing ? "Редактирование цели" : "Новая цель"} onClose={() => setModalOpen(false)}>
        <GoalForm
          initial={editing}
          onCancel={() => setModalOpen(false)}
          onSave={async (payload) => {
            try {
              if (editing) {
                await api.goals.update(userId, editing.id, payload);
                toast.push({ type: "success", title: "Цель обновлена" });
              } else {
                await api.goals.create(userId, payload);
                toast.push({ type: "success", title: "Цель создана" });
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

function GoalForm({
  initial,
  onSave,
  onCancel
}: {
  initial: Goal | null;
  onSave: (payload: Partial<Goal>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
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
        onSave({ title: title.trim(), description: description.trim() || null });
      }}
    >
      {error && <div className="error">{error}</div>}
      <label className="field">
        <span>Название</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, Улучшить сон" />
      </label>
      <label className="field">
        <span>Описание (опц.)</span>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
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
