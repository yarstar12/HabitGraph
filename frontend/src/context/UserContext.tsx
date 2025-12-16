import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type UserContextType = {
  userId: number;
  setUserId: (id: number) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<number>(() => {
    const saved = localStorage.getItem("habitgraph.userId");
    if (saved) {
      const n = Number(saved);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const fallback = Number(import.meta.env.VITE_DEMO_USER_ID ?? 1);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
  });

  useEffect(() => {
    localStorage.setItem("habitgraph.userId", String(userId));
  }, [userId]);

  const value = useMemo(
    () => ({
      userId,
      setUserId: (id: number) => {
        if (!Number.isFinite(id) || id <= 0) return;
        setUserIdState(id);
      }
    }),
    [userId]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}

