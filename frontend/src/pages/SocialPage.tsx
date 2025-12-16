import { useEffect, useState } from "react";
import { api, Recommendation } from "../api";
import { useUser } from "../context/UserContext";

export default function SocialPage() {
  const { userId } = useUser();
  const [items, setItems] = useState<Recommendation[]>([]);
  const [friendId, setFriendId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.social.recommendations(userId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [userId]);

  async function onAddFriend() {
    const id = Number(friendId);
    if (!Number.isFinite(id) || id <= 0) return;
    setLoading(true);
    setError(null);
    try {
      await api.social.addFriend(userId, id);
      setFriendId("");
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
          <p className="eyebrow">Друзья и похожие цели</p>
          <h1>Соцграф HabitGraph</h1>
          <p className="muted">
            Добавляй друзей, ищи людей с похожими целями и привычками. Рекомендации строятся в Neo4j на основании общих
            связей.
          </p>
        </div>
        <div className="hero-actions">
          <div className="chip">user_id: {userId}</div>
          <div className="muted tiny">Меняется в шапке</div>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <input
            value={friendId}
            onChange={(e) => setFriendId(e.target.value)}
            placeholder="user_id друга (например, 2)"
          />
          <button onClick={onAddFriend} disabled={loading}>
            Добавить в друзья
          </button>
          <button onClick={refresh} disabled={loading}>
            Обновить
          </button>
        </div>
        <div className="muted">
          Рекомендации основаны на общих целях/привычках в Neo4j и исключают текущих друзей.
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid">
        {items.map((r) => (
          <div key={r.user_id} className="card">
            <div className="title">
              пользователь {r.user_id} {r.username ? `(${r.username})` : ""}
            </div>
            <div className="muted">
              общие цели: <b>{r.shared_goals}</b> · общие привычки: <b>{r.shared_habits}</b>
            </div>
            <div className="muted">оценка: {r.score}</div>
          </div>
        ))}
        {!items.length && !loading && <div className="card muted">Пока нет рекомендаций.</div>}
      </div>
    </div>
  );
}
