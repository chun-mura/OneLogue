export const APP_TIME_ZONE = "Asia/Tokyo";

type ZonedParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

function getZonedParts(value: string | Date): ZonedParts {
  const instantMs = value instanceof Date ? value.getTime() : parseInstantMs(value);
  const partsDate = new Date(instantMs + 9 * 60 * 60 * 1000);

  return {
    year: String(partsDate.getUTCFullYear()).padStart(4, "0"),
    month: String(partsDate.getUTCMonth() + 1).padStart(2, "0"),
    day: String(partsDate.getUTCDate()).padStart(2, "0"),
    hour: String(partsDate.getUTCHours()).padStart(2, "0"),
    minute: String(partsDate.getUTCMinutes()).padStart(2, "0"),
    second: String(partsDate.getUTCSeconds()).padStart(2, "0")
  };
}

export function toTokyoDateTimeLocalValue(value: string): string {
  const { year, month, day, hour, minute } = getZonedParts(value);
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function toTokyoDateInputValue(value: string | null): string {
  if (!value) return "";
  const { year, month, day } = getZonedParts(value);
  return `${year}-${month}-${day}`;
}

export function toTokyoTimeInputValue(value: string | null): string {
  if (!value) return "";
  const { hour, minute } = getZonedParts(value);
  return `${hour}:${minute}`;
}

export function parseTokyoDateTimeLocal(value: string): string {
  if (!value) return "";
  return new Date(`${value}:00+09:00`).toISOString();
}

export function toTokyoDateKey(value: string | Date): string {
  const { year, month, day } = getZonedParts(value);
  return `${year}-${month}-${day}`;
}

export function getTokyoTimeParts(value: string | Date): { hour: number; minute: number; second: number } {
  const { hour, minute, second } = getZonedParts(value);
  return {
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second)
  };
}

export function formatTokyoDateTime(value: string | null): string {
  if (!value) return "進行中";
  const dateKey = toTokyoDateKey(value);
  const { hour, minute } = getTokyoTimeParts(value);
  return `${dateKey.replaceAll("-", "/")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatTokyoTime(value: string): string {
  const { hour, minute } = getTokyoTimeParts(value);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatTokyoDate(value: string): string {
  return toTokyoDateKey(value).replaceAll("-", "/");
}

export function formatTokyoMonthLabel(value: Date): string {
  const [year, month] = toTokyoDateKey(value).split("-").map(Number);
  return `${year}年${month}月`;
}

export function parseInstantMs(iso: string): number {
  const trimmed = iso.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.exec(trimmed);
  if (dateOnly) {
    const [year, month, day] = dateOnly[0].split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  }
  const hasExplicitTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed);
  return new Date(hasExplicitTz ? trimmed : `${trimmed}Z`).getTime();
}

export function startOfTokyoDayMs(date: Date): number {
  const [year, month, day] = toTokyoDateKey(date).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function isTokyoSameDate(value: string | null, baseDate: Date): boolean {
  if (!value) return false;
  return toTokyoDateKey(value) === toTokyoDateKey(baseDate);
}

export function getTokyoTodayDateString(offsetDays = 0): string {
  const date = new Date();
  const parts = getZonedParts(date);
  const base = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return toTokyoDateKey(base);
}

export function addTokyoDays(dateKey: string, offsetDays: number): string {
  if (!dateKey) return dateKey;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return toTokyoDateKey(date);
}

export function getTokyoMonthStartDate(baseDate: Date): Date {
  const [year, month] = toTokyoDateKey(baseDate).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

export function getTokyoCalendarDays(baseDate: Date): Date[] {
  const firstDay = getTokyoMonthStartDate(baseDate);
  const startOffset = (firstDay.getUTCDay() + 6) % 7;
  const start = new Date(firstDay);
  start.setUTCDate(start.getUTCDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const next = new Date(start);
    next.setUTCDate(start.getUTCDate() + index);
    return next;
  });
}
