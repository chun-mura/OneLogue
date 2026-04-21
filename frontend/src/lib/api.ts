export type TaskStatus = "pending" | "completed" | "archived";

export type Task = {
  id: number;
  title: string;
  category: string;
  priority: number;
  status: TaskStatus;
  created_at: string;
};

export type TimeEntry = {
  id: number;
  task_id: number;
  start_time: string;
  end_time: string | null;
};

export type SummaryItem = {
  category: string;
  total_seconds: number;
};

export type SummaryResponse = {
  range: "daily" | "weekly" | "monthly" | "custom";
  from_date: string;
  to_date: string;
  items: SummaryItem[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export const api = {
  listTasks: () => request<Task[]>("/tasks"),
  createTask: (payload: Omit<Task, "id" | "created_at">) =>
    request<Task>("/tasks", { method: "POST", body: JSON.stringify(payload) }),
  updateTask: (taskId: number, payload: Partial<Omit<Task, "id" | "created_at">>) =>
    request<Task>(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTask: (taskId: number) => request<void>(`/tasks/${taskId}`, { method: "DELETE" }),
  startTask: (taskId: number) =>
    request<{ message: string; active_entry: TimeEntry | null }>(`/tasks/${taskId}/start`, {
      method: "POST"
    }),
  stopTask: (taskId: number) =>
    request<{ message: string; active_entry: TimeEntry | null }>(`/tasks/${taskId}/stop`, {
      method: "POST"
    }),
  getSummary: (range: "daily" | "weekly" | "monthly" | "custom", from?: string, to?: string) => {
    const params = new URLSearchParams({ range });
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    return request<SummaryResponse>(`/stats/summary?${params.toString()}`);
  }
};
