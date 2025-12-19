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
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { message?: string };
      if (data?.message) message = data.message;
    } catch {
      const text = await res.text();
      if (text) message = text;
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export type Habit = {
  id: number;
  user_id: number;
  title: string;
  frequency?: string | null;
  target_value?: number | null;
  target_unit?: string | null;
  reminder_time?: string | null;
  goal_id?: number | null;
  is_archived: boolean;
};

export type Goal = {
  id: number;
  user_id: number;
  title: string;
  description?: string | null;
  is_archived: boolean;
};

export type TodayHabit = {
  habit_id: number;
  title: string;
  done: boolean;
};

export type ActivityPoint = {
  date: string;
  count: number;
};

export type DashboardSummary = {
  user_id: number;
  today_done: number;
  today_total: number;
  habits_today: TodayHabit[];
  week_activity: ActivityPoint[];
  streak_total: number;
  habits_count: number;
  goals_count: number;
  diary_entries: number;
};

export type DiaryEntry = {
  id: string;
  user_id: number;
  text: string;
  tags: string[];
  mood: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at?: string | null;
};

export type DiaryList = {
  items: DiaryEntry[];
  total: number;
  limit: number;
  offset: number;
  sort: string;
};

export type Similar = { entry: DiaryEntry; score: number };

export type Recommendation = {
  user_id: number;
  username?: string | null;
  shared_goals: number;
  shared_habits: number;
  score: number;
};

export type Friend = {
  user_id: number;
  username?: string | null;
};

export type User = {
  id: number;
  username: string;
};

export const api = {
  health: (userId: number) => request<{ status: string }>("/health", userId),

  dashboard: {
    summary: (userId: number) => request<DashboardSummary>("/dashboard/summary", userId)
  },

  habits: {
    list: (userId: number, status: "active" | "archived" | "all" = "active") =>
      request<Habit[]>(`/habits?status=${status}`, userId),
    create: (userId: number, payload: Partial<Habit>) =>
      request<Habit>("/habits", userId, { method: "POST", body: JSON.stringify(payload) }),
    update: (userId: number, habitId: number, payload: Partial<Habit>) =>
      request<Habit>(`/habits/${habitId}`, userId, { method: "PATCH", body: JSON.stringify(payload) })
  },

  goals: {
    list: (userId: number, status: "active" | "archived" | "all" = "active") =>
      request<Goal[]>(`/goals?status=${status}`, userId),
    create: (userId: number, payload: Partial<Goal>) =>
      request<Goal>("/goals", userId, { method: "POST", body: JSON.stringify(payload) }),
    update: (userId: number, goalId: number, payload: Partial<Goal>) =>
      request<Goal>(`/goals/${goalId}`, userId, { method: "PATCH", body: JSON.stringify(payload) })
  },

  checkins: {
    create: (userId: number, habit_id: number) =>
      request("/checkins", userId, { method: "POST", body: JSON.stringify({ habit_id }) })
  },

  diary: {
    list: (userId: number, limit = 10, offset = 0, sort: "desc" | "asc" = "desc") =>
      request<DiaryList>(`/diary?limit=${limit}&offset=${offset}&sort=${sort}`, userId),
    create: (userId: number, payload: Partial<DiaryEntry>) =>
      request<DiaryEntry>("/diary", userId, { method: "POST", body: JSON.stringify(payload) }),
    update: (userId: number, entryId: string, payload: Partial<DiaryEntry>) =>
      request<DiaryEntry>(`/diary/${entryId}`, userId, { method: "PATCH", body: JSON.stringify(payload) }),
    remove: (userId: number, entryId: string) =>
      request(`/diary/${entryId}`, userId, { method: "DELETE" }),
    similarByText: (userId: number, text: string) =>
      request<Similar[]>(`/diary/similar?text=${encodeURIComponent(text)}`, userId)
  },

  social: {
    friends: (userId: number) => request<Friend[]>("/social/friends", userId),
    recommendations: (userId: number) => request<Recommendation[]>("/social/recommendations", userId),
    addFriend: (userId: number, friend_user_id: number) =>
      request("/social/friends", userId, { method: "POST", body: JSON.stringify({ friend_user_id }) })
  },

  users: {
    me: (userId: number) => request<User>("/users/me", userId),
    updateMe: (userId: number, username: string) =>
      request<User>("/users/me", userId, { method: "PATCH", body: JSON.stringify({ username }) }),
    search: (userId: number, query: string, limit = 10) =>
      request<User[]>(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`, userId)
  }
};
