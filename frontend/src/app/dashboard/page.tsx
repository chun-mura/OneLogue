"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api, SummaryItem } from "@/lib/api";

type Range = "daily" | "weekly" | "monthly" | "custom";

const chartColors = ["#0f766e", "#14b8a6", "#f59e0b", "#475569", "#b45309", "#0f172a"];

function formatMinutes(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)} 分`;
}

export default function DashboardPage() {
  const [range, setRange] = useState<Range>("weekly");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [error, setError] = useState<string>("");

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

  async function fetchSummary() {
    setError("");
    try {
      const summary = await api.getSummary(range, fromDate || undefined, toDate || undefined);
      setItems(summary.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "集計取得に失敗しました");
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[36px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">Insights</p>
            <h1 className="max-w-2xl font-[family-name:var(--font-serif)] text-4xl leading-tight text-[color:var(--text)] sm:text-5xl">
              集中の量と偏りを、静かなダッシュボードで確認する。
            </h1>
            <p className="max-w-xl text-sm leading-7 text-[color:var(--muted)] sm:text-base">
              期間ごとのカテゴリ別集計を見ながら、どこに時間を使っているかを把握できます。
            </p>
          </div>

          <div className="rounded-[30px] border border-[color:var(--line)] bg-white/70 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--accent)]">Filter</p>
            <div className="mt-4 grid gap-3">
              <select
                className="rounded-[20px] border border-[color:var(--line)] bg-white px-4 py-3 text-sm text-[color:var(--text)]"
                value={range}
                onChange={(event) => setRange(event.target.value as Range)}
              >
                <option value="daily">日次</option>
                <option value="weekly">週次</option>
                <option value="monthly">月次</option>
                <option value="custom">任意</option>
              </select>
              <input
                type="datetime-local"
                className="rounded-[20px] border border-[color:var(--line)] bg-white px-4 py-3 text-sm text-[color:var(--text)]"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
              <input
                type="datetime-local"
                className="rounded-[20px] border border-[color:var(--line)] bg-white px-4 py-3 text-sm text-[color:var(--text)]"
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
          <p className="mt-5 rounded-[22px] border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[30px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.26em] text-[color:var(--muted)]">Total Time</p>
          <p className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[color:var(--text)]">
            {formatMinutes(totalSeconds)}
          </p>
        </article>
        <article className="rounded-[30px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.26em] text-[color:var(--muted)]">Top Category</p>
          <p className="mt-3 text-2xl font-semibold text-[color:var(--text)]">
            {topCategory?.category ?? "データなし"}
          </p>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {topCategory ? formatMinutes(topCategory.total_seconds) : "集計後に表示されます"}
          </p>
        </article>
        <article className="rounded-[30px] border border-[color:var(--line)] bg-[linear-gradient(160deg,rgba(16,76,71,0.98),rgba(28,57,60,0.96))] p-5 text-white shadow-[var(--shadow)]">
          <p className="text-xs uppercase tracking-[0.26em] text-teal-100/75">Categories</p>
          <p className="mt-3 text-4xl font-semibold tracking-[-0.04em]">{items.length}</p>
          <p className="mt-2 text-sm text-teal-50/75">集計対象カテゴリ数</p>
        </article>
      </section>

      <section className="rounded-[36px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur lg:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--accent)]">Distribution</p>
            <h2 className="mt-2 font-[family-name:var(--font-serif)] text-3xl text-[color:var(--text)]">
              カテゴリ別合計時間
            </h2>
          </div>
          <p className="text-sm text-[color:var(--muted)]">単位: 分</p>
        </div>

        <div className="mt-8 h-80 rounded-[30px] border border-[color:var(--line)] bg-white/70 p-4">
          {items.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-[color:var(--line-strong)] text-sm text-[color:var(--muted)]">
              期間を選んで集計するとグラフが表示されます
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={items.map((item) => ({ ...item, total_minutes: item.total_seconds / 60 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(41, 58, 63, 0.12)" vertical={false} />
                <XAxis dataKey="category" tickLine={false} axisLine={false} stroke="#617076" />
                <YAxis tickLine={false} axisLine={false} stroke="#617076" />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid rgba(41, 58, 63, 0.12)",
                    backgroundColor: "rgba(255, 251, 246, 0.95)",
                    color: "#1f2a2e"
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
