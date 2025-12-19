import { useEffect, useState } from "react";
import { api, Friend, Recommendation, User } from "../api";
import { EmptyState, ErrorState, LoadingGrid, SectionHeader } from "../components/States";
import { useToast } from "../context/ToastContext";
import { useUser } from "../context/UserContext";
import { useOnboarding } from "../context/OnboardingContext";

export default function SocialPage() {
  const { userId } = useUser();
  const toast = useToast();
  const { markStep } = useOnboarding();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [friendsData, recData] = await Promise.all([
        api.social.friends(userId),
        api.social.recommendations(userId)
      ]);
      setFriends(friendsData);
      setRecommendations(recData);
      markStep("social_viewed");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [userId]);

  async function addFriend(friendId: number) {
    try {
      await api.social.addFriend(userId, friendId);
      toast.push({ type: "success", title: "Друг добавлен" });
      await refresh();
    } catch (e) {
      toast.push({ type: "error", title: "Не удалось добавить", description: (e as Error).message });
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    try {
      const results = await api.users.search(userId, searchQuery.trim());
      setSearchResults(results);
      setSearched(true);
    } catch (e) {
      toast.push({ type: "error", title: "Поиск не удался", description: (e as Error).message });
    }
  }

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <p className="eyebrow">Социальное</p>
          <h1>Поддержка через общие цели</h1>
          <p className="muted">
            Добавляй друзей, находи людей с похожими привычками и поддерживай друг друга в пути.
          </p>
        </div>
      </section>

      <section className="stack">
        <SectionHeader title="Мои друзья" subtitle="Люди, с которыми ты делишь прогресс" />
        {loading && <LoadingGrid count={3} />}
        {error && <ErrorState message={error} onRetry={refresh} />}
        {!loading && friends.length === 0 && (
          <EmptyState
            title="Пока нет друзей"
            description="Найди людей с похожими привычками и добавь их в друзья."
          />
        )}
        {!loading && friends.length > 0 && (
          <div className="grid">
            {friends.map((f) => (
              <div key={f.user_id} className="card">
                <div className="title">{f.username ?? "Пользователь"}</div>
                <div className="muted">В друзьях</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid-2">
        <div className="card stack">
          <SectionHeader title="Рекомендации" subtitle="Люди с похожими целями" />
          {recommendations.length === 0 && (
            <EmptyState
              title="Пока нет рекомендаций"
              description="Создай цели и привычки, чтобы появились совпадения."
            />
          )}
          {recommendations.length > 0 && (
            <div className="stack">
              {recommendations.map((r) => (
                <div key={r.user_id} className="row-between">
                  <div>
                    <div className="title">{r.username ?? "Пользователь"}</div>
                    <div className="muted">
                      Общие цели: {r.shared_goals} • Общие привычки: {r.shared_habits}
                    </div>
                  </div>
                  <button className="btn primary" onClick={() => addFriend(r.user_id)}>
                    Добавить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card stack">
          <SectionHeader title="Поиск пользователей" subtitle="По имени или никнейму" />
          <div className="row">
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Введите имя" />
            <button className="btn primary" onClick={handleSearch}>
              Найти
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="stack">
              {searchResults.map((user) => (
                <div key={user.id} className="row-between">
                  <div>
                    <div className="title">{user.username}</div>
                    <div className="muted">Пользователь</div>
                  </div>
                  <button className="btn ghost" onClick={() => addFriend(user.id)}>
                    Добавить
                  </button>
                </div>
              ))}
            </div>
          )}
          {searched && searchResults.length === 0 && (
            <EmptyState title="Никого не найдено" description="Попробуйте изменить запрос." />
          )}
        </div>
      </section>
    </div>
  );
}
