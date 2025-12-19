import { useEffect, useState } from "react";
import { api, User } from "../api";
import { EmptyState, ErrorState, LoadingGrid, SectionHeader } from "../components/States";
import { useToast } from "../context/ToastContext";
import { useUser } from "../context/UserContext";

const PREF_KEY = "habitgraph.preferences";

type Preferences = {
  weeklyReview: boolean;
  reminders: boolean;
};

function loadPreferences(): Preferences {
  const raw = localStorage.getItem(PREF_KEY);
  if (!raw) return { weeklyReview: true, reminders: true };
  try {
    const parsed = JSON.parse(raw) as Preferences;
    return {
      weeklyReview: Boolean(parsed.weeklyReview),
      reminders: Boolean(parsed.reminders)
    };
  } catch {
    return { weeklyReview: true, reminders: true };
  }
}

export default function SettingsPage() {
  const { userId, setUserId, isDebug } = useUser();
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.users.me(userId);
      setUser(data);
      setName(data.username);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [userId]);

  function savePreferences() {
    localStorage.setItem(PREF_KEY, JSON.stringify(preferences));
    toast.push({ type: "success", title: "Настройки сохранены" });
  }

  async function saveProfile() {
    if (!name.trim()) {
      toast.push({ type: "error", title: "Имя не может быть пустым" });
      return;
    }
    try {
      const updated = await api.users.updateMe(userId, name.trim());
      setUser(updated);
      toast.push({ type: "success", title: "Профиль обновлен" });
    } catch (e) {
      toast.push({ type: "error", title: "Не удалось сохранить", description: (e as Error).message });
    }
  }

  return (
    <div className="stack">
      <SectionHeader title="Настройки" subtitle="Личные данные и предпочтения" />

      {loading && <LoadingGrid count={2} />}
      {error && <ErrorState message={error} onRetry={load} />}
      {!loading && !user && <EmptyState title="Профиль недоступен" description="Попробуйте позже" />}

      {!loading && user && (
        <div className="grid-2">
          <div className="card stack">
            <SectionHeader title="Профиль" subtitle="Как к вам обращаться" />
            <label className="field">
              <span>Имя / никнейм</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <button className="btn primary" onClick={saveProfile}>
              Сохранить профиль
            </button>
          </div>

          <div className="card stack">
            <SectionHeader title="Предпочтения" subtitle="Управляйте уведомлениями и обзором" />
            <label className="toggle">
              <input
                type="checkbox"
                checked={preferences.reminders}
                onChange={(e) => setPreferences({ ...preferences, reminders: e.target.checked })}
              />
              Напоминания о привычках
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={preferences.weeklyReview}
                onChange={(e) => setPreferences({ ...preferences, weeklyReview: e.target.checked })}
              />
              Еженедельный обзор
            </label>
            <button className="btn ghost" onClick={savePreferences}>
              Сохранить настройки
            </button>
          </div>
        </div>
      )}

      {isDebug && (
        <div className="card stack">
          <SectionHeader title="Режим разработчика" subtitle="Только для локального теста" />
          <label className="field">
            <span>user_id</span>
            <input value={userId} onChange={(e) => setUserId(Number(e.target.value))} />
          </label>
          <div className="muted tiny">Эта секция видна только если VITE_DEBUG=true.</div>
        </div>
      )}
    </div>
  );
}
