"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { formatSeconds, useTimer } from "@/hooks/useTimer";
import { api, Task, TaskStatus, TimeEntry } from "@/lib/api";

type TaskFormState = {
  title: string;
  category: string;
  priority: number;
  status: TaskStatus;
};

const initialForm: TaskFormState = {
  title: "",
  category: "",
  priority: 2,
  status: "pending"
};

function priorityLabel(priority: number): string {
  switch (priority) {
    case 1:
      return "低";
    case 2:
      return "中";
    case 3:
      return "高";
    default:
      return String(priority);
  }
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

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [form, setForm] = useState<TaskFormState>(initialForm);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<Task | null>(null);

  const elapsedSeconds = useTimer(activeEntry?.start_time ?? null);
  const activeTask = useMemo(
    () => tasks.find((task) => task.id === activeEntry?.task_id) ?? null,
    [tasks, activeEntry]
  );

  const { incompleteTasks, completedTasks } = useMemo(() => {
    const incomplete: Task[] = [];
    const completed: Task[] = [];
    for (const task of tasks) {
      if (task.status === "pending") {
        incomplete.push(task);
      } else {
        completed.push(task);
      }
    }
    return { incompleteTasks: incomplete, completedTasks: completed };
  }, [tasks]);

  async function refreshTasks() {
    const data = await api.listTasks();
    setTasks(data);
  }

  useEffect(() => {
    void refreshTasks();
  }, []);

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title || !form.category) return;
    setLoading(true);
    setError("");
    try {
      await api.createTask(form);
      setForm(initialForm);
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
      setError(err instanceof Error ? err.message : "タイマー開始に失敗しました");
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
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDeleteConfirmTask(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteConfirmTask]);

  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      {deleteConfirmTask ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="presentation"
          onClick={() => setDeleteConfirmTask(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-confirm-title" className="text-lg font-bold text-slate-900">
              タスクを削除しますか？
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              「{deleteConfirmTask.title}」を削除すると元に戻せません。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                disabled={loading}
                onClick={() => setDeleteConfirmTask(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-slate-300"
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

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="mb-4 text-xl font-bold">Tasks</h1>
        <form className="mb-6 grid gap-3 md:grid-cols-4" onSubmit={handleCreateTask}>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="タイトル"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="カテゴリ"
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
          />
          <select
            className="rounded border border-slate-300 px-3 py-2"
            value={form.priority}
            onChange={(e) => setForm((prev) => ({ ...prev, priority: Number(e.target.value) }))}
          >
            <option value={1}>優先度: 低</option>
            <option value={2}>優先度: 中</option>
            <option value={3}>優先度: 高</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:bg-slate-300"
          >
            追加
          </button>
        </form>

        {error && <p className="mb-3 rounded bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p>}

        <div className="space-y-8">
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              未完了
            </h2>
            {incompleteTasks.length === 0 ? (
              <p className="rounded border border-dashed border-slate-200 bg-slate-50/80 px-3 py-6 text-center text-sm text-slate-500">
                未完了のタスクはありません
              </p>
            ) : (
              <ul className="space-y-3">
                {incompleteTasks.map((task) => {
                  const isActive = activeEntry?.task_id === task.id;
                  return (
                    <li
                      key={task.id}
                      className="flex items-center justify-between rounded border border-slate-200 p-3"
                    >
                      <div>
                        <p className="font-semibold">{task.title}</p>
                        <p className="text-sm text-slate-600">
                          {task.category} / 優先度: {priorityLabel(task.priority)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isActive ? (
                          <button
                            className="rounded bg-amber-500 px-3 py-1 text-white"
                            onClick={() => void handleStop(task.id)}
                          >
                            Stop
                          </button>
                        ) : (
                          <button
                            className="rounded bg-green-600 px-3 py-1 text-white"
                            onClick={() => void handleStart(task.id)}
                          >
                            Start
                          </button>
                        )}
                        <button
                          className="rounded bg-slate-700 px-3 py-1 text-white"
                          onClick={() => void handleComplete(task.id)}
                        >
                          完了にする
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-200 pt-8">
            <button
              type="button"
              id="completed-section-toggle"
              className="mb-3 flex w-full items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2 text-left hover:border-slate-200 hover:bg-slate-50"
              aria-expanded={completedOpen}
              aria-controls="completed-task-list"
              onClick={() => setCompletedOpen((open) => !open)}
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  完了
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-700">
                  {completedTasks.length}
                </span>
              </span>
              <span
                className={`inline-block text-slate-400 transition-transform duration-200 ${
                  completedOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              >
                ▼
              </span>
            </button>
            {completedOpen ? (
              completedTasks.length === 0 ? (
                <p
                  id="completed-task-list"
                  className="rounded border border-dashed border-slate-200 bg-slate-50/80 px-3 py-6 text-center text-sm text-slate-500"
                >
                  完了したタスクはありません
                </p>
              ) : (
                <ul id="completed-task-list" className="space-y-3">
                  {completedTasks.map((task) => {
                    const isCompleted = task.status === "completed";
                    return (
                      <li
                        key={task.id}
                        className="flex items-center justify-between rounded border border-slate-200 bg-slate-50/90 p-3"
                      >
                        <div>
                          <p className="font-semibold">{task.title}</p>
                          <p className="text-sm text-slate-600">
                            {task.category} / 優先度: {priorityLabel(task.priority)} /{" "}
                            {statusLabel(task.status)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded border border-slate-300 bg-white px-3 py-1 text-slate-800"
                            onClick={() => void handleReopen(task.id)}
                          >
                            未完了に戻す
                          </button>
                          {isCompleted ? (
                            <button
                              type="button"
                              className="rounded bg-red-600 px-3 py-1 text-white"
                              onClick={() => setDeleteConfirmTask(task)}
                            >
                              削除
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : null}
          </div>
        </div>
      </section>

      <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-bold">現在実行中</h2>
        {activeTask ? (
          <>
            <p className="text-slate-700">{activeTask.title}</p>
            <p className="my-4 text-3xl font-bold tracking-wide">{formatSeconds(elapsedSeconds)}</p>
            <p className="text-sm text-slate-600">カテゴリ: {activeTask.category}</p>
          </>
        ) : (
          <p className="text-slate-600">実行中のタスクはありません</p>
        )}
      </aside>
    </div>
  );
}
