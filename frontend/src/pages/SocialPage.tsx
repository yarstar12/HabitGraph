import { useEffect, useState } from "react";
import { api, Recommendation } from "../api";

export default function SocialPage() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [friendId, setFriendId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.social.recommendations());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onAddFriend() {
    const id = Number(friendId);
    if (!Number.isFinite(id) || id <= 0) return;
    setLoading(true);
    setError(null);
    try {
      await api.social.addFriend(id);
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
      <h1>Social</h1>

      <div className="card">
        <div className="row">
          <input
            value={friendId}
            onChange={(e) => setFriendId(e.target.value)}
            placeholder="Friend user_id (e.g. 2)"
          />
          <button onClick={onAddFriend} disabled={loading}>
            Add friend
          </button>
          <button onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>
        <div className="muted">
          Recommendations are based on shared goals/habits in Neo4j and exclude current friends.
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid">
        {items.map((r) => (
          <div key={r.user_id} className="card">
            <div className="title">
              user {r.user_id} {r.username ? `(${r.username})` : ""}
            </div>
            <div className="muted">
              shared_goals: <b>{r.shared_goals}</b> · shared_habits: <b>{r.shared_habits}</b>
            </div>
            <div className="muted">score: {r.score}</div>
          </div>
        ))}
        {!items.length && !loading && <div className="card muted">No recommendations yet.</div>}
      </div>
    </div>
  );
}

