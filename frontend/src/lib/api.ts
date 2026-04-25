export type TaskStatus = "pending" | "completed" | "archived";

export type Category = {
  id: number;
  name: string;
  created_at: string;
};

export type Task = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  due_at: string | null;
  status: TaskStatus;
  created_at: string;
};

export type TimeEntry = {
  id: number;
  task_id: number;
  start_time: string;
  end_time: string | null;
};

export type TimeEntryDetail = TimeEntry & {
  task_title: string;
  task_category: string;
  task_status: TaskStatus;
};

export type TimeEntryCreatePayload = {
  task_id: number;
  start_time: string;
  end_time: string;
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

async function request(path: string, options?: RequestInit): Promise<Response> {
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
  return response;
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await request(path, options);
  if (response.status === 204) {
    throw new Error("Expected JSON response but received no content");
  }
  const json = (await response.json()) as unknown;
  return json as T;
}

async function requestVoid(path: string, options?: RequestInit): Promise<void> {
  await request(path, options);
}

export const api = {
  listCategories: () => requestJson<Category[]>("/categories"),
  createCategory: (payload: Pick<Category, "name">) =>
    requestJson<Category>("/categories", { method: "POST", body: JSON.stringify(payload) }),
  deleteCategory: (categoryId: number) =>
    requestVoid(`/categories/${categoryId}`, { method: "DELETE" }),
  listTasks: () => requestJson<Task[]>("/tasks"),
  getActiveTimer: () =>
    requestJson<{ message: string; active_entry: TimeEntry | null }>("/tasks/active"),
  listTimeEntries: () => requestJson<TimeEntryDetail[]>("/time-entries"),
  createTimeEntry: (payload: TimeEntryCreatePayload) =>
    requestJson<TimeEntry>("/time-entries", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  createTask: (payload: Omit<Task, "id" | "created_at">) =>
    requestJson<Task>("/tasks", { method: "POST", body: JSON.stringify(payload) }),
  updateTask: (taskId: number, payload: Partial<Omit<Task, "id" | "created_at">>) =>
    requestJson<Task>(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTask: (taskId: number) => requestVoid(`/tasks/${taskId}`, { method: "DELETE" }),
  startTask: (taskId: number) =>
    requestJson<{ message: string; active_entry: TimeEntry | null }>(`/tasks/${taskId}/start`, {
      method: "POST"
    }),
  updateTaskStartTime: (taskId: number, start_time: string) =>
    requestJson<{ message: string; active_entry: TimeEntry | null }>(`/tasks/${taskId}/start`, {
      method: "PATCH",
      body: JSON.stringify({ start_time })
    }),
  stopTask: (taskId: number) =>
    requestJson<{ message: string; active_entry: TimeEntry | null }>(`/tasks/${taskId}/stop`, {
      method: "POST"
    }),
  updateTimeEntry: (
    entryId: number,
    payload: Partial<Pick<TimeEntry, "start_time" | "end_time">>
  ) =>
    requestJson<TimeEntry>(`/time-entries/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteTimeEntry: (entryId: number) => requestVoid(`/time-entries/${entryId}`, { method: "DELETE" }),
  getSummary: (range: "daily" | "weekly" | "monthly" | "custom", from?: string, to?: string) => {
    const params = new URLSearchParams({ range });
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    return requestJson<SummaryResponse>(`/stats/summary?${params.toString()}`);
  }
};
