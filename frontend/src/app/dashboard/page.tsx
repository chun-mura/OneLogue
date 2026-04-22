"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api, SummaryItem } from "@/lib/api";
import { CustomDropdown } from "@/components/custom-dropdown";
import { parseTokyoDateTimeLocal } from "@/lib/datetime";

type Range = "daily" | "weekly" | "monthly" | "custom";

const chartColors = ["#0f766e", "#14b8a6", "#f59e0b", "#475569", "#b45309", "#0f172a"];
const rangeOptions = [
  { value: "daily", label: "日次" },
  { value: "weekly", label: "週次" },
  { value: "monthly", label: "月次" },
  { value: "custom", label: "任意" }
];

function formatMinutes(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)} 分`;
}

export default function DashboardPage() {
  const [range, setRange] = useState<Range>("weekly");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [error, setError] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);

  const totalSeconds = useMemo(
    () => items.reduce((acc, item) => acc + item.total_seconds, 0),
    [items]
  );

  const topCategory = useMemo(
    () =>
      items.reduce<SummaryItem | null>(
        (best, current) => (!best || current.total_seconds > best.total_seconds ? current : best),
        null
      ),
    [items]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  async function fetchSummary() {
    setError("");
    try {
      const summary = await api.getSummary(
        range,
        fromDate ? parseTokyoDateTimeLocal(fromDate) : undefined,
        toDate ? parseTokyoDateTimeLocal(toDate) : undefined
      );
      setItems(summary.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "集計取得に失敗しました");
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)] sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-2">
            <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-[color:var(--text)]">
              集計
            </h1>
            <p className="text-sm text-[color:var(--muted)]">
              期間ごとのカテゴリ別作業時間を確認します。
            </p>
          </div>

          <div className="rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
            <div className="grid gap-3">
              <CustomDropdown
                value={range}
                options={rangeOptions}
                onChange={(next) => setRange(next as Range)}
                placeholder="集計範囲を選択"
              />
              <input
                type="datetime-local"
                className="rounded-[18px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] px-4 py-3 text-sm text-[color:var(--text)]"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
              <input
                type="datetime-local"
                className="rounded-[18px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] px-4 py-3 text-sm text-[color:var(--text)]"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
              <button
                className="rounded-full bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[color:var(--accent-strong)]"
                onClick={() => void fetchSummary()}
              >
                集計を更新
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-5 rounded-[22px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-[22px] border border-[color:var(--line)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow)]">
          <p className="text-sm text-[color:var(--muted)]">合計時間</p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--text)]">
            {formatMinutes(totalSeconds)}
          </p>
        </article>
        <article className="rounded-[22px] border border-[color:var(--line)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow)]">
          <p className="text-sm text-[color:var(--muted)]">最多カテゴリ</p>
          <p className="mt-2 text-xl font-semibold text-[color:var(--text)]">
            {topCategory?.category ?? "データなし"}
          </p>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {topCategory ? formatMinutes(topCategory.total_seconds) : "集計後に表示されます"}
          </p>
        </article>
        <article className="rounded-[22px] border border-[color:var(--line)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow)]">
          <p className="text-sm text-[color:var(--muted)]">カテゴリ数</p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--text)]">{items.length}</p>
          <p className="mt-2 text-sm text-[color:var(--muted)]">集計対象</p>
        </article>
      </section>

      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)] sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[color:var(--text)]">
              カテゴリ別合計時間
            </h2>
          </div>
          <p className="text-sm text-[color:var(--muted)]">単位: 分</p>
        </div>

        <div className="mt-8 h-80 rounded-[30px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
          {!isMounted ? (
            <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-[color:var(--line-strong)] text-sm text-[color:var(--muted)]">
              グラフを準備しています
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-[color:var(--line-strong)] text-sm text-[color:var(--muted)]">
              期間を選んで集計するとグラフが表示されます
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={items.map((item) => ({ ...item, total_minutes: item.total_seconds / 60 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
                <XAxis dataKey="category" tickLine={false} axisLine={false} stroke="#8b8b8b" />
                <YAxis tickLine={false} axisLine={false} stroke="#8b8b8b" />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    backgroundColor: "rgba(35, 35, 35, 0.96)",
                    color: "#f5f5f5"
                  }}
                />
                <Bar dataKey="total_minutes" radius={[14, 14, 0, 0]}>
                  {items.map((item, index) => (
                    <Cell key={`${item.category}-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}
