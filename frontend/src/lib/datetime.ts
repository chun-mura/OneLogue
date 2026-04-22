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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(value instanceof Date ? value : new Date(value));

  return {
    year: parts.find((part) => part.type === "year")?.value ?? "1970",
    month: parts.find((part) => part.type === "month")?.value ?? "01",
    day: parts.find((part) => part.type === "day")?.value ?? "01",
    hour: parts.find((part) => part.type === "hour")?.value ?? "00",
    minute: parts.find((part) => part.type === "minute")?.value ?? "00",
    second: parts.find((part) => part.type === "second")?.value ?? "00"
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
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export function formatTokyoTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export function formatTokyoDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

export function formatTokyoMonthLabel(value: Date): string {
  const [year, month] = toTokyoDateKey(value).split("-").map(Number);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "long"
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function parseInstantMs(iso: string): number {
  const trimmed = iso.trim();
  const hasExplicitTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed);
  return new Date(hasExplicitTz ? trimmed : `${trimmed}Z`).getTime();
}

export function startOfTokyoDayMs(date: Date): number {
  const [year, month, day] = toTokyoDateKey(date).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function isTokyoSameDate(value: string | null, baseDate: Date): boolean {
  if (!value) return false;
  return toTokyoDateKey(new Date(value)) === toTokyoDateKey(baseDate);
}

export function getTokyoTodayDateString(offsetDays = 0): string {
  const date = new Date();
  const parts = getZonedParts(date);
  const base = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return toTokyoDateKey(base);
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
