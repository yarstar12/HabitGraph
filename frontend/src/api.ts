const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, userId: number, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": String(userId),
      ...(init?.headers ?? {})
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

export type Habit = { id: number; user_id: number; title: string };
export type Goal = { id: number; user_id: number; title: string };
export type DashboardHabit = {
  habit_id: number;
  title: string;
  streak: number;
  total_checkins: number;
  last_checkin: string | null;
};
export type Dashboard = { user_id: number; habits: DashboardHabit[] };

export type DiaryEntry = {
  id: string;
  user_id: number;
  text: string;
  tags: string[];
  mood: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
export type Similar = { entry: DiaryEntry; score: number };

export type Recommendation = {
  user_id: number;
  username?: string | null;
  shared_goals: number;
  shared_habits: number;
  score: number;
};

export const api = {
  health: (userId: number) => request<{ status: string }>("/health", userId),

  habits: {
    list: (userId: number) => request<Habit[]>("/habits", userId),
    create: (userId: number, title: string) =>
      request<Habit>("/habits", userId, { method: "POST", body: JSON.stringify({ title }) })
  },
  goals: {
    list: (userId: number) => request<Goal[]>("/goals", userId),
    create: (userId: number, title: string) =>
      request<Goal>("/goals", userId, { method: "POST", body: JSON.stringify({ title }) })
  },
  checkins: {
    create: (userId: number, habit_id: number) =>
      request("/checkins", userId, { method: "POST", body: JSON.stringify({ habit_id }) })
  },
  dashboard: {
    get: (userId: number) => request<Dashboard>("/dashboard", userId)
  },
  diary: {
    list: (userId: number) => request<DiaryEntry[]>("/diary", userId),
    create: (userId: number, text: string, tags: string[], mood?: string) =>
      request<DiaryEntry>("/diary", userId, {
        method: "POST",
        body: JSON.stringify({ text, tags, mood, metadata: {} })
      }),
    similarByText: (userId: number, text: string) =>
      request<Similar[]>(`/diary/similar?text=${encodeURIComponent(text)}`, userId)
  },
  social: {
    recommendations: (userId: number) => request<Recommendation[]>("/social/recommendations", userId),
    addFriend: (userId: number, friend_user_id: number) =>
      request("/social/friends", userId, { method: "POST", body: JSON.stringify({ friend_user_id }) })
  },
  overview: {
    get: (userId: number) => request<Overview>("/overview", userId)
  }
};

export type Overview = {
  user_id: number;
  habits_count: number;
  goals_count: number;
  diary_entries: number;
  checkins_last_7_days: number;
  streak_total: number;
  tips: string[];
};
