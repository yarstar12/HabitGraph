import { FormEvent, useEffect, useState } from "react";
import { api, DiaryEntry, Similar } from "../api";

export default function DiaryPage() {
  const [items, setItems] = useState<DiaryEntry[]>([]);
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [mood, setMood] = useState("");
  const [query, setQuery] = useState("sleep");
  const [similar, setSimilar] = useState<Similar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.diary.list());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.diary.create(
        text.trim(),
        tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        mood.trim() || undefined
      );
      setText("");
      setTags("");
      setMood("");
      await refresh();
    } catch (e2) {
      setError((e2 as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onSearch() {
    setLoading(true);
    setError(null);
    try {
      setSimilar(await api.diary.similarByText(query));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <h1>Diary</h1>

      <form className="card stack" onSubmit={onCreate}>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a diary entry..."
        />
        <div className="row">
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags: sleep,steps" />
          <input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="mood (optional)" />
          <button disabled={loading} type="submit">
            Save
          </button>
        </div>
      </form>

      <div className="card">
        <div className="row">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search similar by text" />
          <button onClick={onSearch} disabled={loading}>
            Search
          </button>
        </div>
        {similar.length > 0 && (
          <div className="stack">
            {similar.map((s) => (
              <div key={s.entry.id} className="card">
                <div className="muted">score: {s.score.toFixed(4)}</div>
                <div className="title">{s.entry.text}</div>
                <div className="muted">tags: {(s.entry.tags ?? []).join(", ")}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="stack">
        {items.map((it) => (
          <div className="card" key={it.id}>
            <div className="title">{it.text}</div>
            <div className="muted">tags: {(it.tags ?? []).join(", ") || "—"}</div>
            <div className="muted">mood: {it.mood ?? "—"}</div>
            <div className="muted">created: {it.created_at}</div>
          </div>
        ))}
        {!items.length && !loading && <div className="card muted">No diary entries yet.</div>}
      </div>
    </div>
  );
}

