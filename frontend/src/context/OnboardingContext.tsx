import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type OnboardingStepId = "semantic_search" | "social_viewed";

type OnboardingContextType = {
  completed: Record<OnboardingStepId, boolean>;
  markStep: (id: OnboardingStepId) => void;
};

const STORAGE_KEY = "habitgraph.onboarding";

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [completed, setCompleted] = useState<Record<OnboardingStepId, boolean>>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { semantic_search: false, social_viewed: false };
    try {
      const parsed = JSON.parse(raw) as Record<OnboardingStepId, boolean>;
      return {
        semantic_search: Boolean(parsed.semantic_search),
        social_viewed: Boolean(parsed.social_viewed)
      };
    } catch {
      return { semantic_search: false, social_viewed: false };
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  }, [completed]);

  const value = useMemo(
    () => ({
      completed,
      markStep: (id: OnboardingStepId) => setCompleted((prev) => ({ ...prev, [id]: true }))
    }),
    [completed]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
