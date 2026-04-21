"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api, SummaryItem } from "@/lib/api";

type Range = "daily" | "weekly" | "monthly" | "custom";

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
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="mb-4 text-xl font-bold">Dashboard</h1>
        <div className="grid gap-3 md:grid-cols-4">
          <select
            className="rounded border border-slate-300 px-3 py-2"
            value={range}
            onChange={(e) => setRange(e.target.value as Range)}
          >
            <option value="daily">日次</option>
            <option value="weekly">週次</option>
            <option value="monthly">月次</option>
            <option value="custom">任意</option>
          </select>
          <input
            type="datetime-local"
            className="rounded border border-slate-300 px-3 py-2"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <input
            type="datetime-local"
            className="rounded border border-slate-300 px-3 py-2"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
          <button
            className="rounded bg-blue-600 px-4 py-2 font-semibold text-white"
            onClick={() => void fetchSummary()}
          >
            集計
          </button>
        </div>
        {error && <p className="mt-4 rounded bg-red-100 px-3 py-2 text-red-700">{error}</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-sm text-slate-500">総計時間</p>
        <p className="text-2xl font-bold">{Math.floor(totalSeconds / 60)} 分</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold">カテゴリ別合計時間（分）</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={items.map((item) => ({ ...item, total_minutes: item.total_seconds / 60 }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total_minutes" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
