"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

import { getTokyoTodayDateString } from "@/lib/datetime";

type AppTimeContextValue = {
  todayKey: string;
  nowIso: string;
};

const AppTimeContext = createContext<AppTimeContextValue | null>(null);

export function AppTimeProvider({
  children,
  initialTodayKey,
  initialNowIso
}: {
  children: ReactNode;
  initialTodayKey: string;
  initialNowIso: string;
}) {
  const [todayKey, setTodayKey] = useState(initialTodayKey);
  const [nowIso, setNowIso] = useState(initialNowIso);

  useEffect(() => {
    let timerId = 0;

    function schedule(nextTodayKey: string) {
      const nextMidnight = new Date(`${nextTodayKey}T00:00:00+09:00`);
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      timerId = window.setTimeout(() => {
        const currentTodayKey = getTokyoTodayDateString();
        setTodayKey(currentTodayKey);
        schedule(currentTodayKey);
      }, Math.max(1000, nextMidnight.getTime() - Date.now()));
    }

    schedule(initialTodayKey);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [initialTodayKey]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowIso(new Date().toISOString());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  return <AppTimeContext.Provider value={{ todayKey, nowIso }}>{children}</AppTimeContext.Provider>;
}

export function useAppTime() {
  const value = useContext(AppTimeContext);
  if (!value) {
    throw new Error("useAppTime must be used within AppTimeProvider");
  }
  return value;
}
