const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const DEMO_USER_ID = String(import.meta.env.VITE_DEMO_USER_ID ?? "1");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": DEMO_USER_ID,
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
  health: () => request<{ status: string }>("/health"),

  habits: {
    list: () => request<Habit[]>("/habits"),
    create: (title: string) => request<Habit>("/habits", { method: "POST", body: JSON.stringify({ title }) })
  },
  goals: {
    list: () => request<Goal[]>("/goals"),
    create: (title: string) => request<Goal>("/goals", { method: "POST", body: JSON.stringify({ title }) })
  },
  checkins: {
    create: (habit_id: number) =>
      request("/checkins", { method: "POST", body: JSON.stringify({ habit_id }) })
  },
  dashboard: {
    get: () => request<Dashboard>("/dashboard")
  },
  diary: {
    list: () => request<DiaryEntry[]>("/diary"),
    create: (text: string, tags: string[], mood?: string) =>
      request<DiaryEntry>("/diary", { method: "POST", body: JSON.stringify({ text, tags, mood, metadata: {} }) }),
    similarByText: (text: string) => request<Similar[]>(`/diary/similar?text=${encodeURIComponent(text)}`)
  },
  social: {
    recommendations: () => request<Recommendation[]>("/social/recommendations"),
    addFriend: (friend_user_id: number) =>
      request("/social/friends", { method: "POST", body: JSON.stringify({ friend_user_id }) })
  }
};

