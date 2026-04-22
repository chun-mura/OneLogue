"use client";

import { useEffect, useMemo, useState } from "react";

import { api, Task, TimeEntryDetail, TaskStatus } from "@/lib/api";
import { CustomDropdown } from "@/components/custom-dropdown";

function toDateTimeLocalValue(value: string): string {
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "進行中";
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo"
  });
}

function formatDuration(start: string, end: string | null): string {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end ?? new Date().toISOString()).getTime();
  const totalMinutes = Math.max(0, Math.floor((endMs - startMs) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}時間 ${minutes}分`;
}

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case "pending":
      return "未完了";
    case "completed":
      return "完了";
    case "archived":
      return "アーカイブ";
    default:
      return status;
  }
}

export default function TimeEntriesPage() {
  const [entries, setEntries] = useState<TimeEntryDetail[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createTaskId, setCreateTaskId] = useState("");
  const [createStartInput, setCreateStartInput] = useState("");
  const [createEndInput, setCreateEndInput] = useState("");
  const [createFormInitialized, setCreateFormInitialized] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [clientNowIso, setClientNowIso] = useState<string | null>(null);

  async function refreshEntries() {
    const data = await api.listTimeEntries();
    setEntries(data);
  }

  async function refreshTasks() {
    const data = await api.listTasks();
    setTasks(data);
  }

  useEffect(() => {
    void (async () => {
      try {
        setError("");
        await Promise.all([refreshEntries(), refreshTasks()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "時間一覧の取得に失敗しました");
      }
    })();
  }, []);

  useEffect(() => {
    setClientNowIso(new Date().toISOString());
  }, []);

  useEffect(() => {
    if (!createFormInitialized && clientNowIso) {
      const end = new Date(clientNowIso);
      const start = new Date(end.getTime() - 60 * 60 * 1000);
      setCreateStartInput(toDateTimeLocalValue(start.toISOString()));
      setCreateEndInput(toDateTimeLocalValue(end.toISOString()));
      setCreateFormInitialized(true);
    }
  }, [clientNowIso, createFormInitialized]);

  const summary = useMemo(() => {
    const completed = entries.filter((entry) => entry.end_time);
    return {
      total: entries.length,
      running: entries.length - completed.length,
      completed: completed.length
    };
  }, [entries]);

  const taskOptions = useMemo(
    () =>
      tasks.map((task) => ({
        value: String(task.id),
        label: task.title,
        description: task.category
      })),
    [tasks]
  );

  async function handleCreate() {
    if (!createTaskId || !createStartInput || !createEndInput) return;

    setCreating(true);
    setError("");
    try {
      await api.createTimeEntry({
        task_id: Number(createTaskId),
        start_time: new Date(createStartInput).toISOString(),
        end_time: new Date(createEndInput).toISOString()
      });
      setCreateTaskId("");
      if (clientNowIso) {
        const end = new Date(clientNowIso);
        const start = new Date(end.getTime() - 60 * 60 * 1000);
        setCreateStartInput(toDateTimeLocalValue(start.toISOString()));
        setCreateEndInput(toDateTimeLocalValue(end.toISOString()));
      } else {
        setCreateStartInput("");
        setCreateEndInput("");
      }
      await refreshEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "時間ログの登録に失敗しました");
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(entry: TimeEntryDetail) {
    if (!startInput) return;

    setLoading(true);
    setError("");
    try {
      const payload: { start_time: string; end_time?: string } = {
        start_time: new Date(startInput).toISOString()
      };
      if (entry.end_time && endInput) {
        payload.end_time = new Date(endInput).toISOString();
      }

      await api.updateTimeEntry(entry.id, payload);
      setEditingEntryId(null);
      setStartInput("");
      setEndInput("");
      await refreshEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "時間の更新に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)] sm:p-6">
        <div className="space-y-2">
          <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-[color:var(--text)]">
            時間ログ
          </h1>
          <p className="text-sm text-[color:var(--muted)]">
            記録した作業時間の確認と編集ができます。
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <article className="rounded-[22px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
            <p className="text-sm text-[color:var(--muted)]">合計</p>
            <p className="mt-2 text-2xl font-semibold text-[color:var(--text)]">{summary.total}</p>
          </article>
          <article className="rounded-[22px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
            <p className="text-sm text-[color:var(--muted)]">進行中</p>
            <p className="mt-2 text-2xl font-semibold text-[color:var(--text)]">{summary.running}</p>
          </article>
          <article className="rounded-[22px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
            <p className="text-sm text-[color:var(--muted)]">完了</p>
            <p className="mt-2 text-2xl font-semibold text-[color:var(--text)]">{summary.completed}</p>
          </article>
        </div>

        {error ? (
          <p className="mt-5 rounded-[22px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)] sm:p-6">
        <div>
          <h2 className="text-xl font-semibold text-[color:var(--text)]">時間ログを登録</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            タスクを選び、開始時刻と終了時刻を指定して保存します。
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
          <div className="space-y-2">
            <span className="text-sm font-semibold text-[color:var(--text)]">タスク</span>
            <CustomDropdown
              value={createTaskId}
              options={taskOptions}
              onChange={setCreateTaskId}
              placeholder={tasks.length === 0 ? "登録済みタスクがありません" : "タスクを選択してください"}
              disabled={tasks.length === 0}
            />
          </div>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-[color:var(--text)]">開始時刻</span>
            <input
              type="datetime-local"
              className="w-full rounded-[20px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] px-4 py-3 text-sm text-[color:var(--text)]"
              value={createStartInput}
              max={clientNowIso ? toDateTimeLocalValue(clientNowIso) : undefined}
              onChange={(event) => setCreateStartInput(event.target.value)}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-[color:var(--text)]">終了時刻</span>
            <input
              type="datetime-local"
              className="w-full rounded-[20px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] px-4 py-3 text-sm text-[color:var(--text)]"
              value={createEndInput}
              max={clientNowIso ? toDateTimeLocalValue(clientNowIso) : undefined}
              onChange={(event) => setCreateEndInput(event.target.value)}
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              disabled={creating || !createTaskId || !createStartInput || !createEndInput}
              className="w-full rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
              onClick={() => void handleCreate()}
            >
              登録
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)] sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[color:var(--text)]">
              時間ログ一覧
            </h2>
          </div>
          <p className="text-sm text-[color:var(--muted)]">{entries.length} 件</p>
        </div>

        <div className="mt-6 space-y-3">
          {entries.length === 0 ? (
            <div className="rounded-[26px] border border-dashed border-[color:var(--line-strong)] bg-[color:var(--surface-soft)] px-4 py-12 text-center text-sm text-[color:var(--muted)]">
              まだ時間ログはありません
            </div>
          ) : (
            entries.map((entry) => {
              const isEditing = editingEntryId === entry.id;
              const isRunning = entry.end_time === null;
              const durationEnd = entry.end_time ?? clientNowIso ?? entry.start_time;

              return (
                <article
                  key={entry.id}
                  className="rounded-[22px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-zinc-300">
                          {entry.task_category}
                        </span>
                        <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-300">
                          {statusLabel(entry.task_status)}
                        </span>
                        <span className="rounded-full bg-amber-500/12 px-3 py-1 text-xs font-semibold text-amber-300">
                          {formatDuration(entry.start_time, durationEnd)}
                        </span>
                        {isRunning ? (
                          <span className="rounded-full bg-emerald-500/16 px-3 py-1 text-xs font-semibold text-emerald-300">
                            進行中
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-3 text-lg font-semibold text-[color:var(--text)]">
                        {entry.task_title}
                      </h3>

                      {isEditing ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-[color:var(--text)]">開始時刻</span>
                            <input
                              type="datetime-local"
                              className="w-full rounded-[20px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] px-4 py-3 text-sm text-[color:var(--text)]"
                              value={startInput}
                              max={clientNowIso ? toDateTimeLocalValue(clientNowIso) : undefined}
                              onChange={(event) => setStartInput(event.target.value)}
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-[color:var(--text)]">終了時刻</span>
                            <input
                              type="datetime-local"
                              className="w-full rounded-[20px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] px-4 py-3 text-sm text-[color:var(--text)]"
                              value={endInput}
                              disabled={isRunning}
                              max={clientNowIso ? toDateTimeLocalValue(clientNowIso) : undefined}
                              onChange={(event) => setEndInput(event.target.value)}
                            />
                          </label>
                          <div className="md:col-span-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={loading || !startInput || (!isRunning && !endInput)}
                              className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => void handleSave(entry)}
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              disabled={loading}
                              className="rounded-full border border-[color:var(--line-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => {
                                setEditingEntryId(null);
                                setStartInput("");
                                setEndInput("");
                              }}
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-2 text-sm text-[color:var(--muted)] sm:grid-cols-2">
                          <p>開始 {formatDateTime(entry.start_time)}</p>
                          <p>終了 {formatDateTime(entry.end_time)}</p>
                        </div>
                      )}
                    </div>

                    {!isEditing ? (
                      <button
                        type="button"
                        disabled={loading}
                        className="rounded-full border border-[color:var(--line-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          setEditingEntryId(entry.id);
                          setStartInput(toDateTimeLocalValue(entry.start_time));
                          setEndInput(entry.end_time ? toDateTimeLocalValue(entry.end_time) : "");
                        }}
                      >
                        時刻を編集
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
