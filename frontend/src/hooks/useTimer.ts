"use client";

import { useEffect, useMemo, useState } from "react";

/** API がタイムゾーン無しで返した場合は UTC として解釈する（SQLite 等の naive 対策） */
function parseInstantMs(iso: string): number {
  const trimmed = iso.trim();
  const hasExplicitTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed);
  return new Date(hasExplicitTz ? trimmed : `${trimmed}Z`).getTime();
}

export function useTimer(startTime: string | null): number {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!startTime) {
      return;
    }
    // 計測開始直後の1フレームで、マウント時の古い now が残らないようにする
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  return useMemo(() => {
    if (!startTime || now === null) {
      return 0;
    }
    const startMs = parseInstantMs(startTime);
    return Math.max(0, Math.floor((now - startMs) / 1000));
  }, [now, startTime]);
}

export function formatSeconds(totalSeconds: number): string {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}
