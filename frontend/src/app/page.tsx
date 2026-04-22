"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { formatSeconds, useTimer } from "@/hooks/useTimer";
import { api, Category, Task, TaskStatus, TimeEntry } from "@/lib/api";

type TaskFormState = {
  title: string;
  category: string;
  due_at: string;
  status: TaskStatus;
};

type DueFilter = "today" | "next7days" | "all";

const initialForm: TaskFormState = {
  title: "",
  category: "",
  due_at: "",
  status: "pending"
};

function formatDueAt(dueAt: string | null): string {
  if (!dueAt) return "期限未設定";
  return new Date(`${dueAt}T00:00:00`).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function dueTone(dueAt: string | null, status: TaskStatus): string {
  if (!dueAt) return "bg-stone-200 text-stone-700";
  const today = new Date();
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dueKey = new Date(`${dueAt}T00:00:00`).getTime();
  if (status === "pending" && dueKey < todayKey) {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-sky-100 text-sky-800";
}

function toApiDueAt(value: string): string | null {
  if (!value) return null;
  return value;
}

function toDateTimeLocalValue(value: string): string {
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatStartTime(value: string): string {
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
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

function isDueWithinFilter(dueAt: string | null, filter: DueFilter): boolean {
  if (filter === "all") return true;
  if (!dueAt) return false;

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const due = new Date(`${dueAt}T00:00:00`).getTime();

  if (filter === "today") {
    return due === start;
  }

  const end = start + 6 * 24 * 60 * 60 * 1000;
  return due >= start && due <= end;
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [form, setForm] = useState<TaskFormState>(initialForm);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<Task | null>(null);
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editingActiveStartTime, setEditingActiveStartTime] = useState(false);
  const [activeStartTimeInput, setActiveStartTimeInput] = useState("");

  const elapsedSeconds = useTimer(activeEntry?.start_time ?? null);
  const activeTask = useMemo(
    () => tasks.find((task) => task.id === activeEntry?.task_id) ?? null,
    [tasks, activeEntry]
  );

  const { incompleteTasks, filteredIncompleteTasks, completedTasks, totalTrackedTaskCount } = useMemo(() => {
    const incomplete: Task[] = [];
    const completed: Task[] = [];

    for (const task of tasks) {
      if (task.status === "pending") {
        incomplete.push(task);
      } else {
        completed.push(task);
      }
    }

    const filteredIncomplete = incomplete.filter((task) => {
      if (categoryFilter !== "all" && task.category !== categoryFilter) {
        return false;
      }

      return isDueWithinFilter(task.due_at, dueFilter);
    });

    return {
      incompleteTasks: incomplete,
      filteredIncompleteTasks: filteredIncomplete,
      completedTasks: completed,
      totalTrackedTaskCount: tasks.length
    };
  }, [tasks, dueFilter, categoryFilter]);

  async function refreshTasks() {
    const data = await api.listTasks();
    setTasks(data);
  }

  async function refreshCategories() {
    const data = await api.listCategories();
    setCategories(data);
    setForm((prev) => {
      if (data.length === 0) {
        return { ...prev, category: "" };
      }
      if (prev.category && data.some((category) => category.name === prev.category)) {
        return prev;
      }
      return { ...prev, category: data[0].name };
    });
  }

  async function syncActiveEntry() {
    const response = await api.getActiveTimer();
    setActiveEntry(response.active_entry);
    return response.active_entry;
  }

  useEffect(() => {
    void (async () => {
      try {
        setError("");
        await Promise.all([refreshTasks(), refreshCategories(), syncActiveEntry()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "初期データの取得に失敗しました");
      }
    })();
  }, []);

  useEffect(() => {
    if (categoryFilter === "all") return;
    if (categories.some((category) => category.name === categoryFilter)) return;
    setCategoryFilter("all");
  }, [categories, categoryFilter]);

  useEffect(() => {
    if (!activeEntry) {
      setEditingActiveStartTime(false);
      setActiveStartTimeInput("");
      return;
    }

    setActiveStartTimeInput(toDateTimeLocalValue(activeEntry.start_time));
  }, [activeEntry]);

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title || !form.category) return;

    setLoading(true);
    setError("");
    try {
      await api.createTask({ ...form, due_at: toApiDueAt(form.due_at) });
      setForm(initialForm);
      await refreshCategories();
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "タスク作成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleStart(taskId: number) {
    setLoading(true);
    setError("");
    try {
      const response = await api.startTask(taskId);
      setActiveEntry(response.active_entry);
      await refreshTasks();
    } catch (err) {
      const message = err instanceof Error ? err.message : "タイマー開始に失敗しました";

      if (message.includes("Task timer is already running")) {
        try {
          await Promise.all([refreshTasks(), syncActiveEntry()]);
          setError("このタスクのタイマーは既に進行中です。表示を同期しました。");
          return;
        } catch {
          setError("タイマーは既に進行中ですが、状態の再同期に失敗しました");
          return;
        }
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStop(taskId: number) {
    setLoading(true);
    setError("");
    try {
      await api.stopTask(taskId);
      setActiveEntry(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "タイマー停止に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateActiveStartTime() {
    if (!activeTask || !activeStartTimeInput) return;

    setLoading(true);
    setError("");
    try {
      const response = await api.updateTaskStartTime(
        activeTask.id,
        new Date(activeStartTimeInput).toISOString()
      );
      setActiveEntry(response.active_entry);
      setEditingActiveStartTime(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "開始時間の更新に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete(taskId: number) {
    setLoading(true);
    setError("");
    try {
      await api.updateTask(taskId, { status: "completed" });
      if (activeEntry?.task_id === taskId) {
        setActiveEntry(null);
      }
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "完了への更新に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleReopen(taskId: number) {
    setLoading(true);
    setError("");
    try {
      await api.updateTask(taskId, { status: "pending" });
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "未完了への戻しに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCompleted(taskId: number): Promise<boolean> {
    setLoading(true);
    setError("");
    try {
      await api.deleteTask(taskId);
      if (activeEntry?.task_id === taskId) {
        setActiveEntry(null);
      }
      await refreshTasks();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "タスクの削除に失敗しました");
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!deleteConfirmTask) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDeleteConfirmTask(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteConfirmTask]);

  return (
    <div className="space-y-6">
      {deleteConfirmTask ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setDeleteConfirmTask(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            className="w-full max-w-md rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-6 shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--danger)]">
              Delete Task
            </p>
            <h2
              id="delete-confirm-title"
              className="mt-2 font-[family-name:var(--font-serif)] text-3xl text-[color:var(--text)]"
            >
              タスクを削除しますか
            </h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              「{deleteConfirmTask.title}」を削除すると、関連する作業ログも含めて元に戻せません。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-[color:var(--line-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] hover:bg-white/80"
                disabled={loading}
                onClick={() => setDeleteConfirmTask(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="rounded-full bg-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                disabled={loading}
                onClick={async () => {
                  const ok = await handleDeleteCompleted(deleteConfirmTask.id);
                  if (ok) setDeleteConfirmTask(null);
                }}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[36px] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-[var(--shadow)] backdrop-blur">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.45fr_0.9fr] lg:px-8 lg:py-9">
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">
                Daily Focus
              </p>
              <div className="space-y-3">
                <h1 className="max-w-2xl font-[family-name:var(--font-serif)] text-4xl leading-tight text-[color:var(--text)] sm:text-5xl">
                  今やるべきことを、静かに一つずつ進めるためのワークスペース。
                </h1>
                <p className="max-w-xl text-sm leading-7 text-[color:var(--muted)] sm:text-base">
                  タスクの追加、実行中の集中、完了までをひとつの流れに整理しました。主役は常に現在のタスクです。
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[28px] border border-[color:var(--line)] bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Open Tasks
                </p>
                <p className="mt-3 text-3xl font-semibold text-[color:var(--text)]">
                  {incompleteTasks.length}
                </p>
              </div>
              <div className="rounded-[28px] border border-[color:var(--line)] bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Completed
                </p>
                <p className="mt-3 text-3xl font-semibold text-[color:var(--text)]">
                  {completedTasks.length}
                </p>
              </div>
              <div className="rounded-[28px] border border-[color:var(--line)] bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Logged Tasks
                </p>
                <p className="mt-3 text-3xl font-semibold text-[color:var(--text)]">
                  {totalTrackedTaskCount}
                </p>
              </div>
            </div>
          </div>

          <aside className="rounded-[32px] border border-[color:var(--line)] bg-[linear-gradient(160deg,rgba(16,76,71,0.98),rgba(28,57,60,0.96))] p-6 text-white shadow-[var(--shadow)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-teal-100/80">
                  Active Session
                </p>
                <h2 className="mt-2 font-[family-name:var(--font-serif)] text-3xl">
                  {activeTask ? "集中中" : "待機中"}
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-teal-50">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                LIVE
              </span>
            </div>

            <div className="mt-8 rounded-[28px] border border-white/10 bg-white/10 p-5">
              <p className="text-sm text-teal-50/70">現在のタスク</p>
              <p className="mt-2 text-2xl font-semibold leading-snug">
                {activeTask ? activeTask.title : "まだ開始されていません"}
              </p>
              <p className="mt-5 text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
                {formatSeconds(elapsedSeconds)}
              </p>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#5eead4,#fef3c7)]"
                  style={{ width: activeTask ? `${Math.min(100, (elapsedSeconds / 7200) * 100)}%` : "12%" }}
                />
              </div>
              <p className="mt-4 text-sm text-teal-50/75">
                {activeTask
                  ? `カテゴリ: ${activeTask.category} / ${formatDueAt(activeTask.due_at)}`
                  : "未完了タスクから 1 件選んで開始してください"}
              </p>
              {activeTask && activeEntry ? (
                <div className="mt-5">
                  <p className="text-sm text-teal-50/75">
                    開始時刻 {formatStartTime(activeEntry.start_time)}
                  </p>
                  {editingActiveStartTime ? (
                    <div className="mt-3 space-y-3">
                      <input
                        type="datetime-local"
                        className="w-full rounded-[18px] border border-white/20 bg-white/12 px-4 py-3 text-sm text-white focus:border-white/40 focus:bg-white/18"
                        value={activeStartTimeInput}
                        max={toDateTimeLocalValue(new Date().toISOString())}
                        onChange={(event) => setActiveStartTimeInput(event.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={loading || !activeStartTimeInput}
                          className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[color:var(--accent-strong)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => void handleUpdateActiveStartTime()}
                        >
                          開始時刻を保存
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/12 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => {
                            setActiveStartTimeInput(toDateTimeLocalValue(activeEntry.start_time));
                            setEditingActiveStartTime(false);
                          }}
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/12 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => setEditingActiveStartTime(true)}
                      >
                        開始時刻を修正
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={loading}
                    className="mt-3 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/12 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void handleStop(activeTask.id)}
                  >
                    このセッションを停止
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </section>

      {error ? (
        <p className="rounded-[24px] border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.95fr]">
        <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--accent)]">
                Capture Task
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-serif)] text-3xl text-[color:var(--text)]">
                新しいタスクを追加
              </h2>
            </div>
            <p className="max-w-xs text-right text-sm leading-6 text-[color:var(--muted)]">
              カテゴリは事前登録制です。期限もここで決めておくと、着手順を迷いにくくなります。
            </p>
          </div>

          <form className="mt-6 grid gap-3 md:grid-cols-2" onSubmit={handleCreateTask}>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-[color:var(--text)]">タイトル</span>
              <input
                className="w-full rounded-[22px] border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm text-[color:var(--text)] placeholder:text-stone-400 focus:border-[color:var(--accent)] focus:bg-white"
                placeholder="例: 提案資料の骨子をまとめる"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[color:var(--text)]">カテゴリ</span>
              <select
                className="w-full rounded-[22px] border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm text-[color:var(--text)] placeholder:text-stone-400 focus:border-[color:var(--accent)] focus:bg-white"
                value={form.category}
                disabled={categories.length === 0}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              >
                {categories.length === 0 ? (
                  <option value="">カテゴリを先に登録してください</option>
                ) : (
                  categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[color:var(--text)]">期限</span>
              <input
                type="date"
                className="w-full rounded-[22px] border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm text-[color:var(--text)] focus:border-[color:var(--accent)] focus:bg-white"
                value={form.due_at}
                onChange={(event) => setForm((prev) => ({ ...prev, due_at: event.target.value }))}
              />
            </label>
            <button
              type="submit"
              disabled={loading || categories.length === 0}
              className="md:col-span-2 inline-flex items-center justify-center rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              タスクを追加
            </button>
          </form>

          {categories.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">
              まだカテゴリがありません。
              <Link href="/categories" className="ml-2 font-semibold text-[color:var(--accent)]">
                カテゴリ管理へ
              </Link>
            </p>
          ) : null}
        </section>

        <section className="flex max-h-[720px] flex-col rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--accent)]">
                Queue
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-serif)] text-3xl text-[color:var(--text)]">
                未完了タスク
              </h2>
            </div>
            <p className="text-sm text-[color:var(--muted)]">
              {filteredIncompleteTasks.length} / {incompleteTasks.length} items
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[color:var(--text)]">期限で絞り込む</span>
              <select
                className="w-full rounded-[22px] border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm text-[color:var(--text)] focus:border-[color:var(--accent)] focus:bg-white"
                value={dueFilter}
                onChange={(event) => setDueFilter(event.target.value as DueFilter)}
              >
                <option value="today">今日</option>
                <option value="next7days">次の7日間</option>
                <option value="all">全て</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-[color:var(--text)]">カテゴリで絞り込む</span>
              <select
                className="w-full rounded-[22px] border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm text-[color:var(--text)] focus:border-[color:var(--accent)] focus:bg-white"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">全て</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {filteredIncompleteTasks.length === 0 ? (
              <div className="rounded-[26px] border border-dashed border-[color:var(--line-strong)] bg-white/50 px-4 py-12 text-center text-sm text-[color:var(--muted)]">
                条件に合う未完了タスクはありません
              </div>
            ) : (
              <ul className="space-y-3">
                {filteredIncompleteTasks.map((task) => {
                  const isActive = activeEntry?.task_id === task.id;

                  return (
                    <li
                      key={task.id}
                      className="rounded-[28px] border border-[color:var(--line)] bg-white/72 p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${dueTone(task.due_at, task.status)}`}
                            >
                              {formatDueAt(task.due_at)}
                            </span>
                            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
                              {task.category}
                            </span>
                            {isActive ? (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                実行中
                              </span>
                            ) : null}
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-[color:var(--text)]">{task.title}</p>
                            <p className="mt-1 text-sm text-[color:var(--muted)]">
                              作成日 {new Date(task.created_at).toLocaleDateString("ja-JP")}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {isActive ? (
                            <button
                              className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                              onClick={() => void handleStop(task.id)}
                            >
                              停止
                            </button>
                          ) : (
                            <button
                              className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--accent-strong)]"
                              onClick={() => void handleStart(task.id)}
                            >
                              開始
                            </button>
                          )}
                          <button
                            className="rounded-full border border-[color:var(--line-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] hover:bg-white"
                            onClick={() => void handleComplete(task.id)}
                          >
                            完了にする
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
        <button
          type="button"
          id="completed-section-toggle"
          className="flex w-full items-center justify-between gap-3 rounded-[22px] bg-white/55 px-4 py-4 text-left hover:bg-white/75"
          aria-expanded={completedOpen}
          aria-controls="completed-task-list"
          onClick={() => setCompletedOpen((open) => !open)}
        >
          <span className="flex items-center gap-3">
            <span>
              <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--accent)]">
                Archive
              </p>
              <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl text-[color:var(--text)]">
                完了済みタスク
              </p>
            </span>
            <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700">
              {completedTasks.length}
            </span>
          </span>
          <span
            className={`inline-block text-sm text-[color:var(--muted)] transition-transform duration-200 ${
              completedOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            ▼
          </span>
        </button>

        {completedOpen ? (
          completedTasks.length === 0 ? (
            <div
              id="completed-task-list"
              className="mt-5 rounded-[26px] border border-dashed border-[color:var(--line-strong)] bg-white/50 px-4 py-12 text-center text-sm text-[color:var(--muted)]"
            >
              完了したタスクはありません
            </div>
          ) : (
            <ul id="completed-task-list" className="mt-5 space-y-3">
              {completedTasks.map((task) => {
                const isCompleted = task.status === "completed";

                return (
                  <li
                    key={task.id}
                    className="rounded-[28px] border border-[color:var(--line)] bg-white/68 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700">
                            {task.category}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${dueTone(task.due_at, task.status)}`}
                          >
                            {formatDueAt(task.due_at)}
                          </span>
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            {statusLabel(task.status)}
                          </span>
                        </div>
                        <p className="mt-3 text-lg font-semibold text-[color:var(--text)]">{task.title}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-[color:var(--line-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] hover:bg-white"
                          onClick={() => void handleReopen(task.id)}
                        >
                          未完了に戻す
                        </button>
                        {isCompleted ? (
                          <button
                            type="button"
                            className="rounded-full bg-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                            onClick={() => setDeleteConfirmTask(task)}
                          >
                            削除
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
      </section>
    </div>
  );
}
