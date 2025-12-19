import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, DiaryEntry, DiaryList, Similar } from "../api";
import { EmptyState, ErrorState, LoadingGrid, SectionHeader } from "../components/States";
import { Modal } from "../components/Modal";
import { useToast } from "../context/ToastContext";
import { useUser } from "../context/UserContext";
import { useOnboarding } from "../context/OnboardingContext";

const moods = ["Отлично", "Хорошо", "Нормально", "Тяжело"];

export default function DiaryPage() {
  const { userId } = useUser();
  const toast = useToast();
  const { markStep } = useOnboarding();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [meta, setMeta] = useState<DiaryList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<"text" | "semantic">("text");
  const [query, setQuery] = useState("");
  const [similar, setSimilar] = useState<Similar[]>([]);
  const [editEntry, setEditEntry] = useState<DiaryEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const limit = 8;

  async function loadEntries(reset = true) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.diary.list(userId, limit, reset ? 0 : entries.length, "desc");
      setMeta(data);
      setEntries(reset ? data.items : [...entries, ...data.items]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEntries(true);
  }, [userId]);

  useEffect(() => {
    if (searchMode === "text") {
      setSimilar([]);
    }
  }, [searchMode]);

  async function handleCreate(payload: Partial<DiaryEntry>) {
    try {
      await api.diary.create(userId, payload);
      toast.push({ type: "success", title: "Запись добавлена" });
      await loadEntries(true);
    } catch (e) {
      toast.push({ type: "error", title: "Не удалось сохранить", description: (e as Error).message });
    }
  }

  async function handleUpdate(payload: Partial<DiaryEntry>) {
    if (!editEntry) return;
    try {
      await api.diary.update(userId, editEntry.id, payload);
      toast.push({ type: "success", title: "Запись обновлена" });
      setModalOpen(false);
      setEditEntry(null);
      await loadEntries(true);
    } catch (e) {
      toast.push({ type: "error", title: "Не удалось обновить", description: (e as Error).message });
    }
  }

  async function handleDelete(entryId: string) {
    if (!window.confirm("Удалить запись?")) return;
    try {
      await api.diary.remove(userId, entryId);
      toast.push({ type: "success", title: "Запись удалена" });
      await loadEntries(true);
    } catch (e) {
      toast.push({ type: "error", title: "Не удалось удалить", description: (e as Error).message });
    }
  }

  async function handleSearch() {
    if (!query.trim()) return;
    if (searchMode === "semantic") {
      try {
        const data = await api.diary.similarByText(userId, query.trim());
        setSimilar(data);
        markStep("semantic_search");
      } catch (e) {
        toast.push({ type: "error", title: "Поиск не удался", description: (e as Error).message });
      }
    }
  }

  const filteredEntries = useMemo(() => {
    if (searchMode !== "text" || !query.trim()) return entries;
    const q = query.trim().toLowerCase();
    return entries.filter((e) => e.text.toLowerCase().includes(q) || e.tags?.join(" ").toLowerCase().includes(q));
  }, [entries, searchMode, query]);

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <p className="eyebrow">Дневник</p>
          <h1>Записывай мысли и наблюдения</h1>
          <p className="muted">
            Короткие заметки помогают отслеживать настроение, привычки и самочувствие. Поиск по смыслу покажет похожие записи.
          </p>
        </div>
      </section>

      <div className="diary-layout">
        <div className="stack">
          <SectionHeader title="Новая запись" subtitle="Быстрое сохранение, чтобы не потерять мысль" />
          <DiaryForm onSubmit={handleCreate} />

          <SectionHeader title="Поиск" subtitle="Найди нужные записи в пару кликов" />
          <div className="card stack">
            <div className="tabs">
              <button className={`tab ${searchMode === "text" ? "active" : ""}`} onClick={() => setSearchMode("text")}>
                Обычный поиск
              </button>
              <button className={`tab ${searchMode === "semantic" ? "active" : ""}`} onClick={() => setSearchMode("semantic")}>
                Поиск по смыслу
              </button>
            </div>
            <div className="row">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Введите текст для поиска" />
              <button className="btn primary" onClick={handleSearch}>
                Найти
              </button>
            </div>
            {searchMode === "semantic" && similar.length > 0 && (
              <div className="stack">
                {similar.map((s) => (
                  <div key={s.entry.id} className="card">
                    <div className="muted tiny">релевантность: {s.score.toFixed(3)}</div>
                    <div className="title">{s.entry.text}</div>
                    <div className="muted">теги: {s.entry.tags?.join(", ") || "—"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <SectionHeader title="Мои записи" subtitle="Последние записи в дневнике" />
          {loading && <LoadingGrid count={3} />}
          {error && <ErrorState message={error} onRetry={() => loadEntries(true)} />}
          {!loading && entries.length === 0 && (
            <EmptyState
              title="Записей пока нет"
              description="Добавь первую запись в дневник — это займет меньше минуты."
            />
          )}

          {!loading && entries.length > 0 && (
            <div className="stack">
              {filteredEntries.length === 0 && searchMode === "text" && query.trim() && (
                <EmptyState title="Ничего не найдено" description="Попробуйте другой запрос." />
              )}
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="card">
                  <div className="row-between">
                    <div>
                      <div className="title">{entry.text}</div>
                      <div className="muted tiny">
                        {new Date(entry.created_at).toLocaleDateString("ru-RU", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                        {entry.mood ? ` • ${entry.mood}` : ""}
                      </div>
                    </div>
                    <div className="row">
                      <button
                        className="btn ghost"
                        onClick={() => {
                          setEditEntry(entry);
                          setModalOpen(true);
                        }}
                      >
                        Редактировать
                      </button>
                      <button className="btn ghost" onClick={() => handleDelete(entry.id)}>
                        Удалить
                      </button>
                    </div>
                  </div>
                  <div className="tags">
                    {(entry.tags ?? []).map((tag) => (
                      <span key={tag} className="chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {meta && entries.length < meta.total && (
                <button className="btn ghost" onClick={() => loadEntries(false)}>
                  Показать еще
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal open={modalOpen} title="Редактирование записи" onClose={() => setModalOpen(false)}>
        {editEntry && (
          <DiaryForm
            initial={editEntry}
            onSubmit={handleUpdate}
            onCancel={() => {
              setModalOpen(false);
              setEditEntry(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function DiaryForm({
  initial,
  onSubmit,
  onCancel
}: {
  initial?: DiaryEntry;
  onSubmit: (payload: Partial<DiaryEntry>) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(initial?.text ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [mood, setMood] = useState(initial?.mood ?? "");
  const [error, setError] = useState<string | null>(null);

  function addTag(value: string) {
    const cleaned = value.trim();
    if (!cleaned) return;
    if (tags.includes(cleaned)) return;
    setTags([...tags, cleaned]);
  }

  function handleTagKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(tagInput);
      setTagInput("");
    }
  }

  return (
    <form
      className="card stack"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (!text.trim()) {
          setError("Текст не может быть пустым");
          return;
        }
        setError(null);
        onSubmit({ text: text.trim(), tags, mood: mood || null, metadata: {} });
        if (!initial) {
          setText("");
          setTags([]);
          setTagInput("");
          setMood("");
        }
      }}
    >
      {error && <div className="error">{error}</div>}
      <textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Напиши короткую заметку..."
      />
      <div className="tags-input">
        {tags.map((tag) => (
          <span key={tag} className="chip" onClick={() => setTags(tags.filter((t) => t !== tag))}>
            {tag} ✕
          </span>
        ))}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleTagKeyDown}
          placeholder="Добавь тег и нажми Enter"
        />
      </div>
      <div className="row-between">
        <select value={mood} onChange={(e) => setMood(e.target.value)}>
          <option value="">Настроение (опц.)</option>
          {moods.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div className="row">
          {onCancel && (
            <button type="button" className="btn ghost" onClick={onCancel}>
              Отмена
            </button>
          )}
          <button type="submit" className="btn primary">
            {initial ? "Сохранить" : "Сохранить запись"}
          </button>
        </div>
      </div>
    </form>
  );
}
