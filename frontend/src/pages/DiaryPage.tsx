import { FormEvent, useEffect, useState } from "react";
import { api, DiaryEntry, Similar } from "../api";
import { useUser } from "../context/UserContext";

export default function DiaryPage() {
  const { userId } = useUser();
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
      setItems(await api.diary.list(userId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [userId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.diary.create(
        userId,
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
      setSimilar(await api.diary.similarByText(userId, query));
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
          <p className="eyebrow">Дневник + смысловой поиск</p>
          <h1>Записывай, чтобы находить инсайты</h1>
          <p className="muted">
            Добавляй заметки про сон, спорт, питание, настроение. Мы сохраняем теги и делаем поиск по смыслу через Qdrant.
          </p>
        </div>
        <div className="hero-actions">
          <div className="chip">user_id: {userId}</div>
          <div className="muted tiny">По умолчанию X-User-Id = {userId}</div>
        </div>
      </div>

      <form className="card stack" onSubmit={onCreate}>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Напиши запись в дневник..."
        />
        <div className="row">
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="теги: сон,шаги" />
          <input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="настроение (опц.)" />
          <button disabled={loading} type="submit">
            Сохранить
          </button>
        </div>
      </form>

      <div className="card">
        <div className="row">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск похожих по смыслу" />
          <button onClick={onSearch} disabled={loading}>
            Найти
          </button>
        </div>
        {similar.length > 0 && (
          <div className="stack">
            {similar.map((s) => (
              <div key={s.entry.id} className="card">
                <div className="muted">релевантность: {s.score.toFixed(4)}</div>
                <div className="title">{s.entry.text}</div>
                <div className="muted">теги: {(s.entry.tags ?? []).join(", ")}</div>
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
            <div className="muted">теги: {(it.tags ?? []).join(", ") || "—"}</div>
            <div className="muted">настроение: {it.mood ?? "—"}</div>
            <div className="muted">создано: {it.created_at}</div>
          </div>
        ))}
        {!items.length && !loading && <div className="card muted">Пока нет записей.</div>}
      </div>
    </div>
  );
}
