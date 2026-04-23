import { toTokyoDateKey } from "@/lib/datetime";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatLocalDateKey(value: Date): string {
  return toTokyoDateKey(value);
}

export function getMonthStartKey(dateKey: string): string {
  if (!dateKey) return "";
  return `${dateKey.slice(0, 7)}-01`;
}

export function addMonths(key: string, months: number): string {
  if (!key) return key;
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + months);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-01`;
}

export function addDays(key: string, days: number): string {
  if (!key) return key;
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return formatLocalDateKey(date);
}

export function buildMonthGrid(monthKey: string): { dateKey: string; inMonth: boolean }[] {
  if (!monthKey) return [];
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = firstDay.getUTCDay();
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

export function getStartOfWeekKey(value: string): string {
  const parts = toTokyoDateKey(value);
  const [year, month, day] = parts.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return formatLocalDateKey(date);
}

export function getWeekLabel(startKey: string): string {
  const [, startMonth, startDay] = startKey.split("-").map(Number);
  const [, endMonth, endDay] = addDays(startKey, 6).split("-").map(Number);
  return `${startMonth}/${startDay} - ${endMonth}/${endDay}`;
}
