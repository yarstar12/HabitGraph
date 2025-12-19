import { useEffect, useMemo, useState } from "react";
import { api, Goal, GoalCatalogItem, Habit } from "../api";
import { EmptyState, ErrorState, LoadingGrid, SectionHeader } from "../components/States";
import { useToast } from "../context/ToastContext";
import { useUser } from "../context/UserContext";

export default function GoalsPage() {
  const { userId } = useUser();
  const toast = useToast();
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [catalog, setCatalog] = useState<GoalCatalogItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [catalogData, goalsData, habitsData] = await Promise.all([
        api.goals.catalog(userId),
        api.goals.list(userId, "all"),
        api.habits.list(userId, "all")
      ]);
      setCatalog(catalogData);
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
  }, [userId]);

  const goalsByCatalog = useMemo(() => {
    const map = new Map<number, Goal>();
    goals.forEach((g) => {
      if (g.catalog_id) map.set(g.catalog_id, g);
    });
    return map;
  }, [goals]);

  const visibleGoals = useMemo(() => {
    return goals.filter((g) => (status === "active" ? !g.is_archived : g.is_archived));
  }, [goals, status]);

  const habitsByGoal = habits.reduce<Record<number, number>>((acc, h) => {
    if (h.goal_id) acc[h.goal_id] = (acc[h.goal_id] ?? 0) + 1;
    return acc;
  }, {});

  async function handleSelect(catalogId: number) {
    try {
      await api.goals.select(userId, catalogId);
      toast.push({ type: "success", title: "Цель добавлена" });
      await refresh();
    } catch (e) {
      toast.push({ type: "error", title: "Не удалось выбрать цель", description: (e as Error).message });
    }
  }

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
        subtitle="Выбирай цели из каталога, чтобы получать рекомендации людей с похожими фокусами."
      />

      <div className="card stack">
        <SectionHeader title="Каталог целей" subtitle="Выберите 1–3 направления, которые хотите улучшить." />
        {loading && <LoadingGrid count={3} />}
        {!loading && catalog.length > 0 && (
          <div className="grid">
            {catalog.map((item) => {
              const selected = goalsByCatalog.get(item.id);
              const isActive = selected && !selected.is_archived;
              return (
                <div key={item.id} className="card">
                  <div className="title">{item.title}</div>
                  <div className="muted">{item.description || "Описание скоро появится"}</div>
                  <div className="row">
                    {!selected && (
                      <button className="btn primary" onClick={() => handleSelect(item.id)}>
                        Выбрать цель
                      </button>
                    )}
                    {selected && selected.is_archived && (
                      <button className="btn ghost" onClick={() => handleArchive(selected, false)}>
                        Вернуть цель
                      </button>
                    )}
                    {isActive && (
                      <button className="btn ghost" disabled>
                        Выбрана
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SectionHeader
        title="Мои цели"
        subtitle="Управляй выбранными целями и связями с привычками."
        action={
          <div className="tabs">
            <button className={`tab ${status === "active" ? "active" : ""}`} onClick={() => setStatus("active")}>
              Активные
            </button>
            <button className={`tab ${status === "archived" ? "active" : ""}`} onClick={() => setStatus("archived")}>
              Архив
            </button>
          </div>
        }
      />

      {loading && <LoadingGrid count={3} />}
      {error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && visibleGoals.length === 0 && (
        <EmptyState
          title={status === "active" ? "Вы ещё не выбрали цели" : "Архив пока пуст"}
          description={
            status === "active"
              ? "Выберите цель из каталога выше — так рекомендации будут точнее."
              : "Верните цель из архива, чтобы снова учитывать её в рекомендациях."
          }
        />
      )}

      {!loading && visibleGoals.length > 0 && (
        <div className="grid">
          {visibleGoals.map((goal) => (
            <div key={goal.id} className="card">
              <div className="title">{goal.title}</div>
              <div className="muted">{goal.description || "Описание скоро появится"}</div>
              <div className="chip">Связанных привычек: {habitsByGoal[goal.id] ?? 0}</div>
              <div className="row">
                <button className="btn ghost" onClick={() => handleArchive(goal, !goal.is_archived)}>
                  {goal.is_archived ? "Вернуть" : "В архив"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
