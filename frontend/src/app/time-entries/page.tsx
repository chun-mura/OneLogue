"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { CustomDropdown } from "@/components/custom-dropdown";
import { useAppTime } from "@/components/app-time-provider";
import { api, Task, TaskStatus, TimeEntryDetail } from "@/lib/api";
import {
  formatTokyoDateTime,
  formatTokyoTime,
  getTokyoTimeParts,
  parseTokyoDateTimeLocal,
  parseInstantMs,
  toTokyoDateKey,
  toTokyoDateTimeLocalValue
} from "@/lib/datetime";

type ViewMode = "calendar" | "list" | "timesheet";

type EditorState = {
  id: number;
  title: string;
  category: string;
  start_time: string;
  end_time: string | null;
};

type CategorySummary = {
  category: string;
  color: string;
  count: number;
  totalSeconds: number;
};

const CATEGORY_COLORS = ["#93c5fd", "#a3e635", "#fbbf24", "#fb7185", "#c4b5fd", "#5eead4", "#fdba74"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function splitDateTimeLocal(value: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

function mergeDateTimeLocal(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

function getMonthStartKey(dateKey: string): string {
  if (!dateKey) return "";
  return `${dateKey.slice(0, 7)}-01`;
}

function addMonths(key: string, months: number): string {
  if (!key) return key;
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + months);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-01`;
}

function buildMonthGrid(monthKey: string): { dateKey: string; inMonth: boolean }[] {
  if (!monthKey) return [];
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = (firstDay.getUTCDay() + 6) % 7;
  const start = new Date(firstDay);
  start.setUTCDate(start.getUTCDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    const dateKey = formatLocalDateKey(day);
    return {
      dateKey,
      inMonth: dateKey.startsWith(monthKey.slice(0, 7))
    };
  });
}

function formatClock(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 3600)}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(
    totalSeconds % 60
  )}`;
}

function formatLocalDateKey(value: Date): string {
  return toTokyoDateKey(value);
}

function formatDayLabel(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];
  const weekday = weekdayLabels[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${month}/${day}(${weekday})`;
}

function getDateKey(value: string): string {
  return toTokyoDateKey(value);
}

function getStartOfWeekKey(value: string): string {
  const parts = toTokyoDateKey(value);
  const [year, month, day] = parts.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return formatLocalDateKey(date);
}

function addDays(key: string, days: number): string {
  if (!key) return key;
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return formatLocalDateKey(date);
}

function getWeekLabel(startKey: string): string {
  const [, startMonth, startDay] = startKey.split("-").map(Number);
  const [, endMonth, endDay] = addDays(startKey, 6).split("-").map(Number);
  return `${startMonth}/${startDay} - ${endMonth}/${endDay}`;
}

function getDurationSeconds(start: string, end: string | null, nowIso?: string): number {
  if (!start) return 0;
  const endTime = end ?? nowIso ?? start;
  const startMs = parseInstantMs(start);
  const endMs = parseInstantMs(endTime);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

function getCategoryColor(category: string): string {
  let hash = 0;
  for (let index = 0; index < category.length; index += 1) {
    hash = (hash * 31 + category.charCodeAt(index)) >>> 0;
  }
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case "pending":
      return "未着手";
    case "completed":
      return "完了";
    case "archived":
      return "アーカイブ";
    default:
      return status;
  }
}

function splitByDay(entries: TimeEntryDetail[], weekStart: string): Record<string, TimeEntryDetail[]> {
  const weekEnd = addDays(weekStart, 6);
  const grouped: Record<string, TimeEntryDetail[]> = {};
  for (const entry of entries) {
    const key = getDateKey(entry.start_time);
    if (key < weekStart || key > weekEnd) continue;
    grouped[key] = grouped[key] ?? [];
    grouped[key].push(entry);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => parseInstantMs(b.start_time) - parseInstantMs(a.start_time));
  }
  return grouped;
}

function formatEntryDuration(entry: TimeEntryDetail): string {
  return formatClock(getDurationSeconds(entry.start_time, entry.end_time));
}

function startOfVisibleMinutes(value: string): number {
  const { hour, minute } = getTokyoTimeParts(value);
  return hour * 60 + minute;
}

function clampCalendarPosition(entry: TimeEntryDetail, nowIso?: string): { top: number; height: number } {
  const visibleStart = 0;
  const visibleEnd = 24 * 60;
  const start = Math.max(visibleStart, startOfVisibleMinutes(entry.start_time));
  const end = Math.min(visibleEnd, startOfVisibleMinutes(entry.end_time ?? nowIso ?? entry.start_time));
  const height = Math.max(30, end - start);
  return {
    top: ((start - visibleStart) / 60) * 64,
    height: (height / 60) * 64
  };
}

function getRunningSeconds(startTime: string, nowIso: string): number {
  if (!startTime || !nowIso) return 0;
  const startMs = parseInstantMs(startTime);
  const nowMs = parseInstantMs(nowIso);
  if (Number.isNaN(startMs) || Number.isNaN(nowMs)) return 0;
  return Math.max(0, Math.floor((nowMs - startMs) / 1000));
}

function getCurrentMinuteOffset(nowIso: string): number {
  const { hour, minute, second } = getTokyoTimeParts(nowIso);
  return hour * 60 + minute + second / 60;
}

function DateTimePopoverField({
  label,
  value,
  onChange,
  disabled = false,
  placeholder = "日時を選択"
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const popoverId = useId();
  const rootId = useId();
  const [open, setOpen] = useState(false);
  const split = splitDateTimeLocal(value);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const current = document.getElementById(rootId);
      if (current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, rootId]);

  const text = split.date
    ? `${split.date.replaceAll("-", "/")} ${split.time || "00:00"}`
    : placeholder;

  return (
    <div id={rootId} className="relative space-y-2">
      <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">{label}</p>
      <button
        type="button"
        disabled={disabled}
        className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] px-4 py-3 text-left text-sm text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={split.date ? "" : "text-[color:var(--muted)]"}>{text}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          id={popoverId}
          className="absolute left-0 top-[calc(100%+8px)] z-30 w-[240px] rounded-[20px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-3 shadow-[var(--shadow)]"
        >
          <div className="grid gap-2.5">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                Date
              </span>
              <input
                type="date"
                className="w-full rounded-[14px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] px-3 py-2 text-sm text-[color:var(--text)]"
                value={split.date}
                onChange={(event) => onChange(mergeDateTimeLocal(event.target.value, split.time))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                Time
              </span>
              <input
                type="time"
                step="60"
                className="w-full rounded-[14px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] px-3 py-2 text-sm text-[color:var(--text)]"
                value={split.time}
                onChange={(event) => onChange(mergeDateTimeLocal(split.date, event.target.value))}
              />
            </label>
            <button
              type="button"
              className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text)]"
              onClick={() => setOpen(false)}
            >
              閉じる
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TimerPopoverField({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  durationLabel,
  runningEntryStartValue,
  nowIso,
  todayKey,
  className = ""
}: {
  startValue: string;
  endValue: string;
  onStartChange: (next: string) => void;
  onEndChange: (next: string) => void;
  durationLabel: string;
  runningEntryStartValue?: string | null;
  nowIso?: string;
  todayKey: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [monthKey, setMonthKey] = useState("");
  const [startDraft, setStartDraft] = useState("");
  const [endDraft, setEndDraft] = useState("");

  const isRunning = Boolean(runningEntryStartValue);

  const sourceStart = isRunning
    ? runningEntryStartValue
      ? toTokyoDateTimeLocalValue(runningEntryStartValue)
      : ""
    : startValue;
  const sourceEnd = isRunning
    ? nowIso
      ? toTokyoDateTimeLocalValue(nowIso)
      : ""
    : endValue;

  const startSplit = splitDateTimeLocal(startDraft);
  const endSplit = isRunning ? splitDateTimeLocal(sourceEnd) : splitDateTimeLocal(endDraft);
  const selectedDateKey = startSplit.date || endSplit.date || "";
  const visibleMonthKey = monthKey || getMonthStartKey(selectedDateKey || todayKey);
  const calendarDays = useMemo(() => buildMonthGrid(visibleMonthKey), [visibleMonthKey]);
  const currentMonthLabel = visibleMonthKey ? `${visibleMonthKey.slice(0, 4)}年${Number(visibleMonthKey.slice(5, 7))}月` : "";

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setMonthKey("");
      return;
    }
    let seedStart = sourceStart;
    let seedEnd = sourceEnd;
    if (!isRunning && !seedStart && !seedEnd) {
      const current = nowIso ?? new Date().toISOString();
      const currentValue = toTokyoDateTimeLocalValue(current);
      seedStart = currentValue;
      seedEnd = currentValue;
    }
    setStartDraft(seedStart);
    setEndDraft(seedEnd);
    setMonthKey(getMonthStartKey(splitDateTimeLocal(seedStart).date || splitDateTimeLocal(seedEnd).date || todayKey));
  }, [open]);

  function setDate(nextDateKey: string) {
    setStartDraft((prev) => mergeDateTimeLocal(nextDateKey, splitDateTimeLocal(prev).time || "00:00"));
    if (!isRunning) {
      setEndDraft((prev) => {
        const prevSplit = splitDateTimeLocal(prev);
        const startSplitNow = splitDateTimeLocal(startDraft);
        return mergeDateTimeLocal(nextDateKey, prevSplit.time || startSplitNow.time || "00:00");
      });
    }
  }

  function handleSave() {
    if (startDraft && startDraft !== sourceStart) {
      onStartChange(startDraft);
    }
    if (!isRunning && endDraft && endDraft !== sourceEnd) {
      onEndChange(endDraft);
    }
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        className="flex h-full w-full items-center justify-between gap-4 rounded-[20px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] px-4 text-left text-sm text-[color:var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        onClick={() => setOpen((current) => !current)}
      >
        <p className="text-[1.45rem] font-semibold tracking-[-0.05em] text-[color:var(--text)]">{durationLabel}</p>
        <svg
          aria-hidden="true"
          viewBox="0 0 18 18"
          className={`h-3.5 w-3.5 shrink-0 text-[color:var(--muted)] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[500px] max-w-[min(500px,calc(100vw-2rem))] rounded-[20px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-3.5 shadow-[var(--shadow)]">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                Start
              </span>
              <div className="flex items-center gap-2.5 rounded-[14px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] px-3 py-2.5">
                <input
                  type="time"
                  step="60"
                  className="min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-[-0.04em] text-[color:var(--text)] outline-none"
                  value={startSplit.time}
                  onChange={(event) =>
                    setStartDraft(mergeDateTimeLocal(startSplit.date || todayKey, event.target.value))
                  }
                />
                <button
                  type="button"
                  className="rounded-full px-2.5 py-1 text-xs font-semibold text-[color:var(--accent-strong)]"
                  onClick={() => {
                    const today = todayKey;
                    setDate(today);
                  }}
                >
                  Today
                </button>
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                Stop
              </span>
              <div
                className={[
                  "rounded-[14px] border bg-[color:var(--bg-soft)] px-3 py-2.5",
                  isRunning ? "border-[color:var(--line)] opacity-65" : "border-[color:var(--line)]"
                ].join(" ")}
              >
                <input
                  type="time"
                  step="60"
                  disabled={isRunning}
                  className="w-full bg-transparent text-xl font-semibold tracking-[-0.04em] text-[color:var(--text)] outline-none disabled:cursor-not-allowed disabled:text-[color:var(--muted)]"
                  value={endSplit.time}
                  onChange={(event) => {
                    if (isRunning) return;
                    setEndDraft(
                      mergeDateTimeLocal(endSplit.date || startSplit.date || todayKey, event.target.value)
                    );
                  }}
                />
              </div>
            </label>
          </div>

          <div className="mt-6 border-t border-[color:var(--line)] pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[20px] font-semibold tracking-[-0.04em] text-[color:var(--text)]">
                {currentMonthLabel}
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-[14px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-2 text-base font-semibold text-[color:var(--text)]"
                  onClick={() => setMonthKey((current) => addMonths(current || visibleMonthKey, -1))}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="rounded-[14px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-2 text-base font-semibold text-[color:var(--text)]"
                  onClick={() => setMonthKey((current) => addMonths(current || visibleMonthKey, 1))}
                >
                  ›
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-semibold text-[color:var(--muted)]">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                <div key={label} className="pb-2">
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1.5">
              {calendarDays.map((day) => {
                const isActive = day.dateKey === selectedDateKey;
                const isToday = day.dateKey === todayKey;
                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    className={[
                      "mx-auto flex h-8 w-8 items-center justify-center rounded-[10px] text-sm font-semibold transition",
                      isActive ? "bg-[color:var(--accent)] text-white" : "text-[color:var(--text)] hover:bg-white/6",
                      !day.inMonth ? "opacity-35" : "",
                      isToday && !isActive ? "ring-1 ring-[color:var(--accent)]" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setDate(day.dateKey)}
                  >
                    {Number(day.dateKey.slice(-2))}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-full bg-white/8 px-4 py-2 text-sm font-medium text-[color:var(--text)] hover:bg-white/12"
              onClick={() => setOpen(false)}
            >
              閉じる
            </button>
            <button
              type="button"
              className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--accent-strong)]"
              onClick={handleSave}
            >
              保存
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function TimeEntriesPage() {
  const { todayKey } = useAppTime();
  const [entries, setEntries] = useState<TimeEntryDetail[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [weekStart, setWeekStart] = useState("");
  const [weekInitialized, setWeekInitialized] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [quickTaskId, setQuickTaskId] = useState("");
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [manualInitialized, setManualInitialized] = useState(false);
  const [editing, setEditing] = useState<EditorState | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [clientNowIso, setClientNowIso] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollCenteredRef = useRef(false);

  async function refresh() {
    const [entryData, taskData, activeData] = await Promise.all([
      api.listTimeEntries(),
      api.listTasks(),
      api.getActiveTimer()
    ]);
    setEntries(entryData);
    setTasks(taskData);
    setActiveTaskId(activeData.active_entry?.task_id ?? null);
  }

  useEffect(() => {
    void (async () => {
      try {
        setError("");
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "時間ログの取得に失敗しました");
      }
    })();
  }, []);

  useEffect(() => {
    setIsMounted(true);
    setClientNowIso(new Date().toISOString());
    const timer = window.setInterval(() => setClientNowIso(new Date().toISOString()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (weekInitialized) return;
    if (entries.length > 0) {
      setWeekStart(getStartOfWeekKey(entries[0].start_time));
    } else {
      setWeekStart(getStartOfWeekKey(todayKey));
    }
    setWeekInitialized(true);
  }, [entries, weekInitialized, todayKey]);

  useEffect(() => {
    if (!isMounted || manualInitialized || !clientNowIso) return;
    setManualInitialized(true);
  }, [clientNowIso, isMounted, manualInitialized]);

  useEffect(() => {
    if (!weekStart) return;
    const weekEnd = addDays(weekStart, 6);
    if (selectedDayKey && selectedDayKey >= weekStart && selectedDayKey <= weekEnd) return;
    const fallback = todayKey >= weekStart && todayKey <= weekEnd ? todayKey : weekStart;
    setSelectedDayKey(fallback);
  }, [weekStart, todayKey, selectedDayKey]);

  useEffect(() => {
    if (scrollCenteredRef.current) return;
    if (viewMode !== "calendar" || !clientNowIso) return;
    const offsetPx = (getCurrentMinuteOffset(clientNowIso) / 60) * 64;
    let applied = false;
    for (const el of [desktopScrollRef.current, mobileScrollRef.current]) {
      if (!el) continue;
      const h = el.clientHeight;
      el.scrollTo({ top: Math.max(0, offsetPx - (h > 0 ? h / 2 : 240)) });
      if (h > 0) applied = true;
    }
    if (applied) scrollCenteredRef.current = true;
  }, [viewMode, clientNowIso]);

  useEffect(() => {
    if (activeTaskId === null) return;
    const activeTask = tasks.find((task) => task.id === activeTaskId);
    if (!activeTask) return;
    setQuickTaskId((current) => (current === String(activeTaskId) ? current : String(activeTaskId)));
  }, [activeTaskId, tasks]);

  const quickTask = useMemo(
    () => tasks.find((task) => task.id === Number(quickTaskId)) ?? null,
    [quickTaskId, tasks]
  );

  const weekEntries = useMemo(() => {
    if (!weekStart) return [];
    const weekEnd = addDays(weekStart, 6);
    return entries.filter((entry) => {
      const dayKey = getDateKey(entry.start_time);
      if (dayKey < weekStart || dayKey > weekEnd) return false;
      return true;
    });
  }, [entries, weekStart]);

  const weekDays = useMemo(() => {
    if (!weekStart) return [];
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [weekStart]);

  const listWeekDays = useMemo(() => [...weekDays].reverse(), [weekDays]);

  const groupedEntries = useMemo(() => splitByDay(weekEntries, weekStart), [weekEntries, weekStart]);

  const categorySummaries = useMemo<CategorySummary[]>(() => {
    const map = new Map<string, CategorySummary>();
    for (const entry of weekEntries) {
      const current = map.get(entry.task_category) ?? {
        category: entry.task_category,
        color: getCategoryColor(entry.task_category),
        count: 0,
        totalSeconds: 0
      };
      current.count += 1;
      current.totalSeconds += getDurationSeconds(entry.start_time, entry.end_time, clientNowIso || undefined);
      map.set(entry.task_category, current);
    }
    return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [weekEntries, clientNowIso]);

  const dayTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const day of weekDays) totals.set(day, 0);
    for (const entry of weekEntries) {
      const key = getDateKey(entry.start_time);
      totals.set(key, (totals.get(key) ?? 0) + getDurationSeconds(entry.start_time, entry.end_time, clientNowIso || undefined));
    }
    return totals;
  }, [weekEntries, weekDays, clientNowIso]);

  const timesheetRows = useMemo(() => {
    const rows = new Map<string, Map<string, number>>();
    for (const entry of weekEntries) {
      const dayKey = getDateKey(entry.start_time);
      const category = entry.task_category;
      const dayMap = rows.get(category) ?? new Map<string, number>();
      dayMap.set(dayKey, (dayMap.get(dayKey) ?? 0) + getDurationSeconds(entry.start_time, entry.end_time, clientNowIso || undefined));
      rows.set(category, dayMap);
    }

    return Array.from(rows.entries())
      .map(([category, dayMap]) => ({
        category,
        color: getCategoryColor(category),
        totalSeconds: Array.from(dayMap.values()).reduce((sum, value) => sum + value, 0),
        days: weekDays.map((dayKey) => ({ dayKey, totalSeconds: dayMap.get(dayKey) ?? 0 }))
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [weekEntries, weekDays, clientNowIso]);

  const totalSeconds = useMemo(
    () => weekEntries.reduce((sum, entry) => sum + getDurationSeconds(entry.start_time, entry.end_time, clientNowIso || undefined), 0),
    [weekEntries, clientNowIso]
  );

  const activeRunningEntry = useMemo(
    () => entries.find((entry) => entry.task_id === activeTaskId && entry.end_time === null) ?? null,
    [activeTaskId, entries]
  );

  const activeTimerSeconds =
    activeRunningEntry && clientNowIso
      ? getRunningSeconds(activeRunningEntry.start_time, clientNowIso)
      : 0;
  const isQuickTaskRunning = Boolean(activeRunningEntry);

  const currentTodayKey = clientNowIso ? getDateKey(clientNowIso) : "";
  const currentMinuteOffset = clientNowIso ? getCurrentMinuteOffset(clientNowIso) : 0;
  const todaySeconds = useMemo(
    () =>
      weekEntries
        .filter((entry) => getDateKey(entry.start_time) === currentTodayKey)
        .reduce((sum, entry) => sum + getDurationSeconds(entry.start_time, entry.end_time, clientNowIso || undefined), 0),
    [weekEntries, currentTodayKey, clientNowIso]
  );

  const selectedWeekLabel = weekStart ? getWeekLabel(weekStart) : "";

  async function handleQuickStart() {
    setLoading(true);
    setError("");
    try {
      if (activeRunningEntry) {
        await api.stopTask(activeRunningEntry.task_id);
        setQuickTaskId("");
        setActiveTaskId(null);
      } else {
        if (!quickTask) return;
        const response = await api.startTask(quickTask.id);
        setActiveTaskId(response.active_entry?.task_id ?? null);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "タイマー操作に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateManualEntry() {
    if (!quickTaskId || !manualStart || !manualEnd) return;

    setCreating(true);
    setError("");
    try {
      await api.createTimeEntry({
        task_id: Number(quickTaskId),
        start_time: parseTokyoDateTimeLocal(manualStart),
        end_time: parseTokyoDateTimeLocal(manualEnd)
      });
      const end = clientNowIso ? new Date(clientNowIso) : new Date();
      const start = new Date(end.getTime() - 60 * 60 * 1000);
      setManualStart(toTokyoDateTimeLocalValue(start.toISOString()));
      setManualEnd(toTokyoDateTimeLocalValue(end.toISOString()));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "時間ログの登録に失敗しました");
    } finally {
      setCreating(false);
    }
  }

  function openEditor(entry: TimeEntryDetail) {
    setEditing({
      id: entry.id,
      title: entry.task_title,
      category: entry.task_category,
      start_time: entry.start_time,
      end_time: entry.end_time
    });
    setEditStart(toTokyoDateTimeLocalValue(entry.start_time));
    setEditEnd(entry.end_time ? toTokyoDateTimeLocalValue(entry.end_time) : "");
  }

  async function handleSaveEntry() {
    if (!editing) return;

    setSaving(true);
    setError("");
    try {
      const payload: { start_time: string; end_time?: string } = {
        start_time: parseTokyoDateTimeLocal(editStart)
      };
      if (editing.end_time !== null && editEnd) {
        payload.end_time = parseTokyoDateTimeLocal(editEnd);
      }

      await api.updateTimeEntry(editing.id, payload);
      setEditing(null);
      setEditStart("");
      setEditEnd("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "時間ログの更新に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEntry(entry: Pick<TimeEntryDetail, "id" | "task_title">) {
    const confirmed = window.confirm(`「${entry.task_title}」を削除しますか？`);
    if (!confirmed) return;

    setDeletingEntryId(entry.id);
    setError("");
    try {
      await api.deleteTimeEntry(entry.id);
      if (editing?.id === entry.id) {
        setEditing(null);
        setEditStart("");
        setEditEnd("");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "時間ログの削除に失敗しました");
    } finally {
      setDeletingEntryId(null);
    }
  }

  const quickTaskOptions = useMemo(
    () =>
      tasks.map((task) => ({
        value: String(task.id),
        label: task.title,
        description: `${task.category} · ${statusLabel(task.status)}`
      })),
    [tasks]
  );

  const isEditingRunningEntry = editing?.end_time === null;

  const renderNowLine = () => (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        className="absolute left-1/2 top-0 w-1 -translate-x-1/2 rounded-full bg-[color:var(--accent)]/85 shadow-[0_0_18px_rgba(192,113,204,0.35)]"
        style={{ height: `${Math.max(0, Math.min(1536, (currentMinuteOffset / 60) * 64))}px` }}
      />
      <div
        className="absolute left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[color:var(--accent)] shadow-[0_0_0_5px_rgba(192,113,204,0.18)]"
        style={{ top: `${Math.max(0, Math.min(1536, (currentMinuteOffset / 60) * 64))}px` }}
      />
      <div
        className="absolute left-[calc(50%+10px)] -translate-y-1/2 rounded-full border border-[color:var(--accent)] bg-[color:var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-strong)] shadow-[0_0_16px_rgba(192,113,204,0.16)]"
        style={{ top: `${Math.max(0, Math.min(1536, (currentMinuteOffset / 60) * 64))}px` }}
      >
        Now
      </div>
    </div>
  );

  const renderEntryCard = (entry: TimeEntryDetail) => {
    const color = getCategoryColor(entry.task_category);
    const position = clampCalendarPosition(entry, clientNowIso || undefined);
    const isDimmed = selectedCategory !== null && selectedCategory !== entry.task_category;
    const isRunning = entry.end_time === null;
    return (
      <div
        key={entry.id}
        className={[
          "group absolute left-2 right-2 overflow-hidden rounded-[18px] border p-3 text-left shadow-[0_10px_25px_rgba(0,0,0,0.18)] transition hover:translate-y-[-1px]",
          isDimmed ? "opacity-45" : "opacity-100",
          isRunning ? "ring-1 ring-[color:var(--accent)] ring-offset-0" : "",
          "cursor-pointer"
        ].join(" ")}
        style={{
          top: `${position.top}px`,
          height: `${position.height}px`,
          borderColor: hexToRgba(color, isDimmed ? 0.18 : 0.3),
          background: isRunning
            ? `linear-gradient(180deg, ${hexToRgba(color, 0.28)}, ${hexToRgba(color, 0.12)})`
            : `linear-gradient(180deg, ${hexToRgba(color, isDimmed ? 0.08 : 0.16)}, ${hexToRgba(color, isDimmed ? 0.04 : 0.08)})`
        }}
        role="button"
        tabIndex={0}
        onClick={() => openEditor(entry)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openEditor(entry);
          }
        }}
      >
        <div
          className={[
            "absolute inset-x-0 top-0 h-1",
            isRunning ? "animate-pulse" : ""
          ].join(" ")}
          style={{ backgroundColor: color }}
        />
        <p className="line-clamp-2 text-[13px] font-semibold leading-5 text-[color:var(--text)]">
          {entry.task_title}
        </p>
        <p className="mt-1.5 flex items-center gap-2 text-[10px] text-[color:var(--muted)]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          {entry.task_category}
          {isRunning ? (
            <span className="rounded-full border border-[color:var(--accent)] bg-[color:var(--accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-strong)]">
              Live
            </span>
          ) : null}
        </p>
        <div className="mt-auto flex items-end justify-end gap-2 pt-2 text-[11px] text-[color:var(--muted)]">
          <span>{isRunning ? formatClock(getRunningSeconds(entry.start_time, clientNowIso)) : formatEntryDuration(entry)}</span>
        </div>
        {isRunning ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{
                width: "100%",
                background: `linear-gradient(90deg, ${hexToRgba(color, 0.55)}, ${hexToRgba(color, 0.9)})`
              }}
            />
          </div>
        ) : null}
      </div>
    );
  };

  const mainView = (
    <section className="overflow-hidden rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-[var(--shadow)]">
      <div className="border-b border-[color:var(--line)] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[32px] font-semibold tracking-[-0.05em] text-[color:var(--text)] sm:text-[40px]">
              What are you working on?
            </p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              タイマー開始、手動登録、週次の見直しをひとつの画面で行えます。
            </p>
          </div>
        </div>

        <div className="mt-6 grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.4fr)_300px_auto]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">Task</p>
            <CustomDropdown
              value={quickTaskId}
              options={quickTaskOptions}
              onChange={setQuickTaskId}
              placeholder={tasks.length === 0 ? "登録済みタスクがありません" : "タスクを選択"}
              disabled={tasks.length === 0}
              className="w-full h-12 [&>button]:h-full [&>button]:py-0"
            />
          </div>

          <div className="space-y-2 self-stretch">
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)] opacity-0 select-none">
              Timer
            </p>
            <div className="flex h-12 items-stretch gap-3">
            <TimerPopoverField
              className="min-w-0 flex-1"
              startValue={manualStart}
              endValue={manualEnd}
              onStartChange={(next) => {
                if (activeRunningEntry) {
                  if (!next) return;
                  const iso = parseTokyoDateTimeLocal(next);
                  if (!iso) return;
                  void (async () => {
                    try {
                      await api.updateTimeEntry(activeRunningEntry.id, { start_time: iso });
                      await refresh();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "開始時間の更新に失敗しました");
                    }
                  })();
                } else {
                  setManualStart(next);
                }
              }}
              onEndChange={setManualEnd}
              durationLabel={activeRunningEntry ? formatClock(activeTimerSeconds) : formatClock(getDurationSeconds(manualStart, manualEnd))}
              runningEntryStartValue={activeRunningEntry?.start_time ?? null}
              nowIso={clientNowIso || undefined}
              todayKey={todayKey}
            />

              <button
                type="button"
                disabled={loading || (!quickTask && !activeRunningEntry)}
                className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_12px_30px_rgba(79,124,255,0.35)] disabled:cursor-not-allowed disabled:opacity-50 ${
                  isQuickTaskRunning
                    ? "bg-[color:var(--danger)] hover:bg-[color:var(--danger)]"
                    : "bg-[color:var(--accent)] hover:bg-[color:var(--accent-strong)]"
                }`}
                onClick={() => void handleQuickStart()}
                aria-label={isQuickTaskRunning ? "停止" : "開始"}
              >
                <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="currentColor" aria-hidden="true">
                  {isQuickTaskRunning ? (
                    <rect x="6.4" y="6.4" width="7.2" height="7.2" rx="1.3" />
                  ) : (
                    <path d="M7.4 5.4v9.2l7.2-4.6-7.2-4.6Z" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              disabled={creating || !quickTaskId}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent)] text-white shadow-[0_12px_30px_rgba(79,124,255,0.35)] hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void handleCreateManualEntry()}
            >
              <span className="sr-only">Add entry</span>
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  d="M10 4v12M4 10h12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {error ? (
          <p className="mt-5 rounded-[22px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </div>

      <div className="border-b border-[color:var(--line)] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
              onClick={() => setWeekStart((current) => addDays(current, -7))}
            >
              ←
            </button>
            <div className="rounded-[18px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-3">
              <p className="text-sm font-semibold text-[color:var(--text)]">{selectedWeekLabel}</p>
            </div>
            <button
              type="button"
              className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
              onClick={() => setWeekStart((current) => addDays(current, 7))}
            >
              →
            </button>

            <div className="flex items-center gap-4 text-sm text-[color:var(--muted)]">
              <span>
                Today <strong className="text-[color:var(--text)]">{formatClock(todaySeconds)}</strong>
              </span>
              <span>
                Week total <strong className="text-[color:var(--text)]">{formatClock(totalSeconds)}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["calendar", "list", "timesheet"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={[
                  "rounded-full px-5 py-2.5 text-sm font-semibold transition",
                  viewMode === mode
                    ? "border border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                    : "border border-[color:var(--line)] bg-[color:var(--surface-strong)] text-[color:var(--muted)] hover:text-[color:var(--text)]"
                ].join(" ")}
                onClick={() => setViewMode(mode)}
              >
                {mode === "calendar" ? "Calendar" : mode === "list" ? "List view" : "Timesheet"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={[
              "rounded-full border px-4 py-2 text-sm font-semibold",
              selectedCategory === null
                ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                : "border-[color:var(--line)] bg-[color:var(--surface-strong)] text-[color:var(--muted)]"
            ].join(" ")}
            onClick={() => setSelectedCategory(null)}
          >
            All projects
          </button>
          {categorySummaries.map((summary) => (
            <button
              key={summary.category}
              type="button"
              className={[
                "rounded-full border px-4 py-2 text-sm font-semibold",
                selectedCategory === summary.category
                  ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                  : "border-[color:var(--line)] bg-[color:var(--surface-strong)] text-[color:var(--muted)]"
              ].join(" ")}
              style={selectedCategory === summary.category ? { borderColor: hexToRgba(summary.color, 0.55) } : undefined}
              onClick={() =>
                setSelectedCategory((current) => (current === summary.category ? null : summary.category))
              }
            >
              {summary.category} · {formatClock(summary.totalSeconds)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-[var(--shadow)]">
          {viewMode === "calendar" ? (
            <>
            <div className="hidden sm:block overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[72px_repeat(7,minmax(130px,1fr))] border-b border-[color:var(--line)] bg-[color:var(--surface-strong)]">
                  <div className="flex items-center justify-center border-r border-[color:var(--line)] py-4 text-xs uppercase tracking-[0.22em] text-[color:var(--muted)]">
                    +
                  </div>
                  {weekDays.map((dayKey) => {
                    const total = dayTotals.get(dayKey) ?? 0;
                    const isToday = dayKey === todayKey;
                    return (
                      <div
                        key={dayKey}
                        className={[
                          "border-r border-[color:var(--line)] px-4 py-4 last:border-r-0 transition",
                          isToday
                            ? "bg-[color:var(--accent-soft)]/12 border-l border-[color:var(--accent)]/30 shadow-[inset_0_0_0_1px_rgba(79,124,255,0.12)]"
                            : ""
                        ].join(" ")}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                          {formatDayLabel(dayKey)}
                        </p>
                        <div className="mt-1 flex items-end justify-between gap-2">
                          <div className="relative inline-flex items-center">
                            {isToday ? (
                              <span className="absolute inset-x-[-10px] inset-y-[-6px] rounded-full bg-[color:var(--accent)]/18" />
                            ) : null}
                            <p
                              className={[
                                "relative z-10 text-3xl font-semibold tracking-[-0.05em] transition",
                                isToday ? "text-[color:var(--accent-strong)]" : "text-[color:var(--text)]"
                              ].join(" ")}
                            >
                              {Number(dayKey.slice(-2))}
                            </p>
                          </div>
                          <p className={isToday ? "text-xs font-semibold text-[color:var(--accent-strong)]" : "text-xs text-[color:var(--muted)]"}>
                            {formatClock(total)}
                          </p>
                        </div>
                      </div>
                  );
                })}
                </div>

                <div ref={desktopScrollRef} className="max-h-[calc(100vh-360px)] overflow-auto">
                  <div className="grid grid-cols-[72px_repeat(7,minmax(130px,1fr))]">
                    <div className="border-r border-[color:var(--line)]">
                      {Array.from({ length: 24 }, (_, index) => index).map((hour) => (
                        <div
                          key={hour}
                          className="flex h-16 items-start justify-end border-b border-[color:var(--line)] px-3 pt-2 text-[11px] text-[color:var(--muted)]"
                        >
                          {pad(hour)}:00
                        </div>
                      ))}
                    </div>

                    {weekDays.map((dayKey) => (
                      <div
                        key={dayKey}
                        className={[
                          "relative min-h-[1536px] border-r border-[color:var(--line)] last:border-r-0 transition",
                          dayKey === todayKey
                            ? "bg-[color:var(--accent-soft)]/6 border-l border-[color:var(--accent)]/25 shadow-[inset_0_0_0_1px_rgba(79,124,255,0.1)]"
                            : ""
                        ].join(" ")}
                      >
                        {dayKey === todayKey ? renderNowLine() : null}
                        {Array.from({ length: 24 }, (_, index) => index).map((index) => (
                          <div key={index} className="h-16 border-b border-[color:var(--line)]" />
                        ))}
                        {(groupedEntries[dayKey] ?? []).map(renderEntryCard)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="sm:hidden">
              <div className="flex gap-2 overflow-x-auto border-b border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-3">
                {weekDays.map((dayKey) => {
                  const total = dayTotals.get(dayKey) ?? 0;
                  const isActive = dayKey === selectedDayKey;
                  const isToday = dayKey === todayKey;
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => setSelectedDayKey(dayKey)}
                      className={[
                        "flex shrink-0 flex-col items-center rounded-[14px] border px-3 py-2 text-xs transition",
                        isActive
                          ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                          : "border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--muted)]",
                        isToday && !isActive ? "ring-1 ring-[color:var(--accent)]/50" : ""
                      ].join(" ")}
                    >
                      <span className="font-semibold text-[color:var(--text)]">{formatDayLabel(dayKey)}</span>
                      <span className="mt-0.5 text-[10px]">{formatClock(total)}</span>
                    </button>
                  );
                })}
              </div>

              <div ref={mobileScrollRef} className="max-h-[calc(100vh-420px)] overflow-auto">
                <div className="grid grid-cols-[48px_1fr]">
                  <div className="border-r border-[color:var(--line)]">
                    {Array.from({ length: 24 }, (_, index) => index).map((hour) => (
                      <div
                        key={hour}
                        className="flex h-16 items-start justify-end border-b border-[color:var(--line)] px-2 pt-2 text-[10px] text-[color:var(--muted)]"
                      >
                        {pad(hour)}:00
                      </div>
                    ))}
                  </div>
                  <div
                    className={[
                      "relative min-h-[1536px] transition",
                      selectedDayKey === todayKey
                        ? "bg-[color:var(--accent-soft)]/6 shadow-[inset_0_0_0_1px_rgba(79,124,255,0.1)]"
                        : ""
                    ].join(" ")}
                  >
                    {selectedDayKey === todayKey ? renderNowLine() : null}
                    {Array.from({ length: 24 }, (_, index) => index).map((index) => (
                      <div key={index} className="h-16 border-b border-[color:var(--line)]" />
                    ))}
                    {selectedDayKey ? (groupedEntries[selectedDayKey] ?? []).map(renderEntryCard) : null}
                  </div>
                </div>
              </div>
            </div>
            </>
          ) : viewMode === "list" ? (
            <div className="space-y-4 p-5 sm:p-6">
              {listWeekDays.map((dayKey) => {
                const dayEntries = groupedEntries[dayKey] ?? [];
                if (dayEntries.length === 0) return null;
                const total = dayTotals.get(dayKey) ?? 0;
                return (
                  <section key={dayKey} className="overflow-hidden rounded-[28px] border border-[color:var(--line)]">
                    <header className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-4">
                      <p className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--text)]">
                        {formatDayLabel(dayKey)}
                      </p>
                      <p className="text-sm font-semibold text-[color:var(--text)]">{formatClock(total)}</p>
                    </header>
                    <div className="divide-y divide-[color:var(--line)]">
                      {dayEntries.map((entry) => {
                        const color = getCategoryColor(entry.task_category);
                        const isDimmed = selectedCategory !== null && selectedCategory !== entry.task_category;
                        return (
                          <div
                            key={entry.id}
                            className={[
                              "group flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-[color:var(--surface-soft)]",
                              isDimmed ? "opacity-55" : "opacity-100"
                            ].join(" ")}
                            role="button"
                            tabIndex={0}
                            onClick={() => openEditor(entry)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openEditor(entry);
                              }
                            }}
                          >
                            <div className="min-w-0">
                              <h3 className="truncate text-[15px] font-semibold text-[color:var(--text)]">
                                {entry.task_title}
                              </h3>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
                                <span
                                  className="rounded-full px-2.5 py-1 font-medium"
                                  style={{ backgroundColor: hexToRgba(color, isDimmed ? 0.08 : 0.12), color }}
                                >
                                  {entry.task_category}
                                </span>
                                <span className="rounded-full bg-[color:var(--bg-soft)] px-2.5 py-1 font-medium">
                                  {statusLabel(entry.task_status)}
                                </span>
                              </div>
                            </div>
                            <div className="text-right text-sm text-[color:var(--muted)]">
                              <p>{formatTokyoTime(entry.start_time)}</p>
                              <p className="mt-1">{formatTokyoDateTime(entry.end_time)}</p>
                              <p className="mt-2 text-base font-semibold text-[color:var(--text)]">
                                {formatEntryDuration(entry)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {weekEntries.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-[color:var(--line-strong)] bg-[color:var(--surface-soft)] px-6 py-16 text-center text-sm text-[color:var(--muted)]">
                  この条件に一致する時間ログはありません
                </div>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto p-5 sm:p-6">
              <div className="min-w-[780px] overflow-hidden rounded-[28px] border border-[color:var(--line)]">
                <div className="grid grid-cols-[220px_repeat(7,minmax(96px,1fr))_110px] border-b border-[color:var(--line)] bg-[color:var(--surface-strong)]">
                  <div className="px-4 py-4 text-sm font-semibold text-[color:var(--text)]">Project</div>
                  {weekDays.map((dayKey) => (
                    <div key={dayKey} className="px-3 py-4 text-center text-xs uppercase tracking-[0.22em] text-[color:var(--muted)]">
                      {formatDayLabel(dayKey)}
                    </div>
                  ))}
                  <div className="px-4 py-4 text-right text-sm font-semibold text-[color:var(--text)]">Total</div>
                </div>

                <div className="divide-y divide-[color:var(--line)]">
                  {timesheetRows.length === 0 ? (
                    <div className="px-6 py-16 text-center text-sm text-[color:var(--muted)]">
                      期間を切り替えるとタイムシートが表示されます
                    </div>
                  ) : (
                    timesheetRows.map((row) => (
                      <div
                        key={row.category}
                        className="grid grid-cols-[220px_repeat(7,minmax(96px,1fr))_110px]"
                      >
                        <div className="flex items-center gap-3 px-4 py-4">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                          <button
                            type="button"
                            className="truncate text-left text-sm font-medium text-[color:var(--text)]"
                            onClick={() =>
                            setSelectedCategory((current) => (current === row.category ? null : row.category))
                            }
                          >
                            {row.category}
                          </button>
                        </div>
                        {row.days.map((cell) => (
                          <div
                            key={`${row.category}-${cell.dayKey}`}
                            className="border-l border-[color:var(--line)] px-3 py-4 text-center text-sm text-[color:var(--muted)]"
                          >
                            {cell.totalSeconds > 0 ? formatClock(cell.totalSeconds) : "—"}
                          </div>
                        ))}
                        <div className="px-4 py-4 text-right text-sm font-semibold text-[color:var(--text)]">
                          {formatClock(row.totalSeconds)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[color:var(--text)]">Goals</h2>
              <button
                type="button"
                className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)]"
              >
                +
              </button>
            </div>
            <div className="mt-5 rounded-[26px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--muted)]">Weekly target</p>
                  <p className="mt-2 text-2xl font-semibold text-[color:var(--text)]">40:00:00</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--muted)]">Progress</p>
                  <p className="mt-2 text-xl font-semibold text-[color:var(--accent-strong)]">{formatClock(totalSeconds)}</p>
                </div>
              </div>
              <div className="mt-4 h-3 rounded-full bg-[color:var(--bg-soft)]">
                <div
                  className="h-full rounded-full bg-[color:var(--accent)]"
                  style={{ width: `${Math.min(100, (totalSeconds / (40 * 3600)) * 100)}%` }}
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                現在の週の稼働を可視化し、目標に対する進捗を確認します。
              </p>
            </div>
          </section>

          <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[color:var(--text)]">Summary</h2>
              <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--muted)]">Current week</p>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-[22px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-3">
                <span className="text-sm text-[color:var(--muted)]">Today</span>
                <span className="text-sm font-semibold text-[color:var(--text)]">{formatClock(todaySeconds)}</span>
              </div>
              <div className="flex items-center justify-between rounded-[22px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-3">
                <span className="text-sm text-[color:var(--muted)]">Week total</span>
                <span className="text-sm font-semibold text-[color:var(--text)]">{formatClock(totalSeconds)}</span>
              </div>
              <div className="flex items-center justify-between rounded-[22px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-3">
                <span className="text-sm text-[color:var(--muted)]">Entries</span>
                <span className="text-sm font-semibold text-[color:var(--text)]">{weekEntries.length}</span>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)]">
            <h2 className="text-lg font-semibold text-[color:var(--text)]">Projects</h2>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                className={[
                  "flex w-full items-center justify-between rounded-[22px] border px-4 py-3 text-left",
                  selectedCategory === null
                    ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                    : "border-[color:var(--line)] bg-[color:var(--surface-strong)]"
                ].join(" ")}
                onClick={() => setSelectedCategory(null)}
              >
                <span className="text-sm font-semibold text-[color:var(--text)]">All projects</span>
                <span className="text-xs text-[color:var(--muted)]">{weekEntries.length}</span>
              </button>
              {categorySummaries.map((summary) => (
                <button
                  key={summary.category}
                  type="button"
                  className={[
                    "flex w-full items-center justify-between rounded-[22px] border px-4 py-3 text-left",
                    selectedCategory === summary.category
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                      : "border-[color:var(--line)] bg-[color:var(--surface-strong)]"
                  ].join(" ")}
                  onClick={() =>
                    setSelectedCategory((current) => (current === summary.category ? null : summary.category))
                  }
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: summary.color }} />
                    <span className="min-w-0 truncate text-sm font-semibold text-[color:var(--text)]">
                      {summary.category}
                    </span>
                  </span>
                  <span className="text-xs text-[color:var(--muted)]">{formatClock(summary.totalSeconds)}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );

  return (
    <div className="space-y-5 pb-8">
      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setEditing(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-xl rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-6 shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--muted)]">Edit entry</p>
                <h2 className="mt-2 text-xl font-semibold text-[color:var(--text)]">{editing.title}</h2>
                <p className="mt-1 text-sm text-[color:var(--muted)]">{editing.category}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-2 text-sm font-medium text-[color:var(--text)]"
                onClick={() => setEditing(null)}
              >
                閉じる
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <DateTimePopoverField label="開始時刻" value={editStart} onChange={setEditStart} />
              <DateTimePopoverField
                label="終了時刻"
                value={editEnd}
                onChange={setEditEnd}
                disabled={isEditingRunningEntry}
                placeholder={isEditingRunningEntry ? "進行中" : "日時を選択"}
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="mr-auto rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={deletingEntryId === editing.id}
                onClick={() => void handleDeleteEntry({ id: editing.id, task_title: editing.title })}
              >
                削除
              </button>
              <button
                type="button"
                className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
                onClick={() => setEditing(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={saving || !editStart || (!isEditingRunningEntry && !editEnd)}
                className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void handleSaveEntry()}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mainView}
    </div>
  );
}
