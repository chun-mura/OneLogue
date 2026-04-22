"use client";

import { FormEvent, RefObject, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { formatSeconds, useTimer } from "@/hooks/useTimer";
import { api, Category, Task, TaskStatus, TimeEntry } from "@/lib/api";

type TaskFormState = {
  title: string;
  category: string;
  due_at: string;
  due_time: string;
  status: TaskStatus;
};

type DueFilter = "today" | "next7days" | "all";
type SectionKey = "overdue" | "today" | "upcoming" | "completed";
type TaskSort = "dueAsc" | "dueDesc" | "createdDesc" | "createdAsc" | "titleAsc";
type DuePickerMode = "create" | "task";
type DuePickerPosition = {
  top: number;
  left: number;
};

const initialForm: TaskFormState = {
  title: "",
  category: "",
  due_at: "",
  due_time: "",
  status: "pending"
};

const weekLabels = ["日", "月", "火", "水", "木", "金", "土"];
const dueTimeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

function formatDueAt(dueAt: string | null): string {
  if (!dueAt) return "期限なし";
  const date = new Date(dueAt);
  const dateLabel = date.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric"
  });
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  if (hours === "00" && minutes === "00") return dateLabel;
  return `${dateLabel} ${hours}:${minutes}`;
}

function formatMonthLabel(baseDate: Date): string {
  return `${baseDate.getFullYear()}年${baseDate.getMonth() + 1}月`;
}

function formatStartTime(value: string): string {
  return new Date(value).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
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

function toLocalDateInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalTimeValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function startOfDayMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function parseDueMs(value: string | null): number | null {
  if (!value) return null;
  return new Date(value).getTime();
}

function hasExplicitDueTime(value: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  return date.getHours() !== 0 || date.getMinutes() !== 0;
}

function combineDueDateTime(dateValue: string, timeValue: string): string | null {
  if (!dateValue) return null;
  const normalizedTime = timeValue || "00:00";
  const iso = new Date(`${dateValue}T${normalizedTime}:00`).toISOString();
  return iso;
}

function isToday(value: string | null): boolean {
  const due = parseDueMs(value);
  if (due === null) return false;
  const date = new Date(due);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isSameLocalDate(value: string | null, baseDate: Date): boolean {
  const due = parseDueMs(value);
  if (due === null) return false;
  const date = new Date(due);
  return (
    date.getFullYear() === baseDate.getFullYear() &&
    date.getMonth() === baseDate.getMonth() &&
    date.getDate() === baseDate.getDate()
  );
}

function isOverdue(value: string | null): boolean {
  const due = parseDueMs(value);
  if (due === null) return false;
  if (hasExplicitDueTime(value)) {
    return due < Date.now();
  }
  return due < startOfDayMs(new Date());
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

function dueChipTone(task: Task): string {
  if (!task.due_at) return "bg-white/6 text-[color:var(--muted)]";
  if (isOverdue(task.due_at) && task.status === "pending") {
    return "bg-[color:var(--danger-soft)] text-[color:var(--danger)]";
  }
  if (isToday(task.due_at)) {
    return "bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  }
  return "bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]";
}

function compareTasks(a: Task, b: Task, sort: TaskSort): number {
  if (sort === "titleAsc") {
    return a.title.localeCompare(b.title, "ja");
  }

  if (sort === "createdDesc") {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }

  if (sort === "createdAsc") {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }

  const aDue = parseDueMs(a.due_at);
  const bDue = parseDueMs(b.due_at);

  if (aDue === null && bDue === null) {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }
  if (aDue === null) return 1;
  if (bDue === null) return -1;

  if (sort === "dueDesc") {
    const diff = bDue - aDue;
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }

  const diff = aDue - bDue;
  if (diff !== 0) return diff;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function getTodayDateString(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCalendarDays(baseDate: Date): Date[] {
  const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function matchesDueFilter(task: Task, filter: DueFilter): boolean {
  if (filter === "all") return true;
  if (!task.due_at) return false;

  const todayDate = new Date();
  const today = startOfDayMs(todayDate);
  const due = parseDueMs(task.due_at);
  if (due === null) return false;
  const dueDate = new Date(due);
  const dueDay = startOfDayMs(dueDate);

  if (filter === "today") {
    return isSameLocalDate(task.due_at, todayDate);
  }

  return dueDay >= today && dueDay <= today + 6 * 24 * 60 * 60 * 1000;
}

function IconPlus() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 5.5h12M4 10h8M4 14.5h12" strokeLinecap="round" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4.5" width="14" height="12" rx="3" />
      <path d="M6.5 3v3M13.5 3v3M3 8h14" strokeLinecap="round" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5v4l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M10 2.8v2.8M10 14.4v2.8M2.8 10h2.8M14.4 10h2.8M5 5l2 2M13 13l2 2M15 5l-2 2M7 13l-2 2" strokeLinecap="round" />
      <circle cx="10" cy="10" r="3.1" />
    </svg>
  );
}

function IconIdea() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path
        d="M7.4 14.9h5.2M8 17h4M10 2.7a5.3 5.3 0 0 0-3.5 9.3c.6.5 1 1.2 1.1 2h4.8c.1-.8.5-1.5 1.1-2A5.3 5.3 0 0 0 10 2.7Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSidebar() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 4v12M13 4v12" strokeLinecap="round" />
    </svg>
  );
}

function IconDots() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
      <circle cx="4" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="16" cy="10" r="1.5" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 10.5 8.2 14 15 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m5.5 7.5 4.5 5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m11.8 5.5-4.5 4.5 4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m8.2 5.5 4.5 4.5-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionHeader({
  title,
  count,
  tone
}: {
  title: string;
  count: number;
  tone?: "danger" | "default";
}) {
  return (
    <div className="mb-2 flex items-center gap-3 px-1">
      <span className="text-[color:var(--muted)]">
        <IconChevronDown />
      </span>
      <span className="text-[15px] font-semibold text-[color:var(--text)]">
        {title}
      </span>
      <span className="text-sm text-[color:var(--muted)]">{count}</span>
    </div>
  );
}

function TaskRow({
  task,
  isActive,
  isAnimatingComplete,
  onStart,
  onStop,
  isEditingTitle,
  editingTitleValue,
  onEditTitleStart,
  onEditTitleChange,
  onEditTitleCommit,
  onEditTitleCancel,
  isEditingDue,
  onEditDueStart,
  isEditingCategory,
  editingCategoryValue,
  categoryOptions,
  categoryMenuRef,
  categoryTriggerRef,
  onEditCategoryStart,
  onEditCategoryChange,
  onEditCategoryCommit,
  onEditCategoryCancel,
  onToggleComplete,
  onDelete
}: {
  task: Task;
  isActive: boolean;
  isAnimatingComplete: boolean;
  onStart: () => void;
  onStop: () => void;
  isEditingTitle: boolean;
  editingTitleValue: string;
  onEditTitleStart: () => void;
  onEditTitleChange: (value: string) => void;
  onEditTitleCommit: () => void;
  onEditTitleCancel: () => void;
  isEditingDue: boolean;
  onEditDueStart: (anchor: HTMLButtonElement) => void;
  isEditingCategory: boolean;
  editingCategoryValue: string;
  categoryOptions: string[];
  categoryMenuRef: RefObject<HTMLDivElement | null>;
  categoryTriggerRef: RefObject<HTMLButtonElement | null>;
  onEditCategoryStart: () => void;
  onEditCategoryChange: (value: string) => void;
  onEditCategoryCommit: (value?: string) => void;
  onEditCategoryCancel: () => void;
  onToggleComplete: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-4 rounded-[20px] border border-transparent px-4 py-3.5 text-[color:var(--text)] transition ${
        isAnimatingComplete
          ? "scale-[0.992] bg-emerald-500/[0.08]"
          : isActive
            ? "bg-white/[0.06]"
            : "hover:border-white/6 hover:bg-white/[0.03]"
      }`}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleComplete();
        }}
        className={`relative flex h-7 w-7 items-center justify-center rounded-[10px] border transition duration-200 ${
          task.status === "completed"
            ? "border-white/0 bg-white/10 text-[color:var(--muted)]"
            : "border-white/20 bg-transparent text-transparent hover:scale-105 hover:border-[color:var(--accent-strong)] hover:bg-[color:var(--accent-soft)]"
        }`}
        aria-label={task.status === "completed" ? "未完了に戻す" : "完了にする"}
      >
        {task.status !== "completed" ? (
          <span className="absolute inset-0 rounded-[10px] opacity-0 transition duration-200 group-hover:opacity-100 group-hover:shadow-[0_0_0_4px_rgba(79,124,255,0.12)]" />
        ) : null}
        {isAnimatingComplete ? (
          <span className="absolute inset-[-4px] animate-ping rounded-[14px] bg-emerald-400/20" />
        ) : null}
        {task.status === "completed" ? <IconCheck /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          {isEditingTitle ? (
            <input
              autoFocus
              value={editingTitleValue}
              onChange={(event) => onEditTitleChange(event.target.value)}
              onBlur={onEditTitleCommit}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onEditTitleCommit();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  onEditTitleCancel();
                }
              }}
              className="min-w-0 flex-1 appearance-none rounded-[12px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] px-3 py-2 text-[16px] text-[color:var(--text)] focus:outline-none"
              aria-label="タスクタイトルを編集"
            />
          ) : (
            <button
              type="button"
              onClick={onEditTitleStart}
              className={`truncate text-left text-[16px] transition hover:opacity-80 ${
                task.status === "completed" ? "text-[color:var(--muted)] line-through" : "text-[color:var(--text)]"
              }`}
            >
              {task.title}
            </button>
          )}
          {isActive ? (
            <span className="rounded-full bg-emerald-500/18 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--success)]">
              実行中
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={(event) => onEditDueStart(event.currentTarget)}
            className={`rounded-full px-2.5 py-1 font-semibold ${dueChipTone(task)} ${
              isEditingDue ? "ring-1 ring-[color:var(--accent-strong)]" : ""
            }`}
          >
            {formatDueAt(task.due_at)}
          </button>
          <div className="relative">
            <button
              ref={isEditingCategory ? categoryTriggerRef : null}
              type="button"
              onClick={onEditCategoryStart}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium ${
                isEditingCategory
                  ? "border-[color:var(--line-strong)] bg-white/8 text-[color:var(--text)]"
                  : "border-[color:var(--line)] bg-white/[0.04] text-[color:var(--muted)] hover:border-[color:var(--line-strong)] hover:bg-white/[0.06]"
              }`}
              aria-label={`${task.category}カテゴリを編集`}
            >
              <span>{isEditingCategory ? editingCategoryValue : task.category}</span>
              <span className="text-[color:var(--muted)]">
                <IconChevronRight />
              </span>
            </button>

            {isEditingCategory ? (
              <div
                ref={categoryMenuRef}
                className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-[160px] rounded-[16px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] py-2 shadow-[var(--shadow)]"
              >
                {categoryOptions.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                      editingCategoryValue === category ? "text-[color:var(--accent-strong)]" : "text-[color:var(--text)]"
                    } hover:bg-white/6`}
                    onClick={() => {
                      onEditCategoryChange(category);
                      onEditCategoryCommit(category);
                    }}
                  >
                    <span>{category}</span>
                    {editingCategoryValue === category ? <IconCheck /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <span className="text-[color:var(--muted)]">{statusLabel(task.status)}</span>
        </div>
      </div>

      <div className="hidden items-center gap-2 opacity-0 transition group-hover:opacity-100 md:flex">
        {task.status === "pending" ? (
          isActive ? (
            <button
              type="button"
              className="rounded-full bg-white/8 px-3 py-2 text-sm font-medium text-[color:var(--text)] hover:bg-white/12"
              onClick={(event) => {
                event.stopPropagation();
                onStop();
              }}
            >
              停止
            </button>
          ) : (
            <button
              type="button"
              className="rounded-full bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[color:var(--accent-strong)]"
              onClick={(event) => {
                event.stopPropagation();
                onStart();
              }}
            >
              開始
            </button>
          )
        ) : null}
        {onDelete ? (
          <button
            type="button"
            className="rounded-full bg-[color:var(--danger-soft)] px-3 py-2 text-sm font-medium text-[color:var(--danger)] hover:opacity-90"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            削除
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [form, setForm] = useState<TaskFormState>(initialForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<Task | null>(null);
  const [editingTitleTaskId, setEditingTitleTaskId] = useState<number | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [editingDueTaskId, setEditingDueTaskId] = useState<number | null>(null);
  const [editingDueValue, setEditingDueValue] = useState("");
  const [editingDueTimeValue, setEditingDueTimeValue] = useState("");
  const [editingCategoryTaskId, setEditingCategoryTaskId] = useState<number | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState("");
  const [createCategoryMenuOpen, setCreateCategoryMenuOpen] = useState(false);
  const [categoryFilterMenuOpen, setCategoryFilterMenuOpen] = useState(false);
  const [taskSortMenuOpen, setTaskSortMenuOpen] = useState(false);
  const [animatingCompleteTaskIds, setAnimatingCompleteTaskIds] = useState<number[]>([]);
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [taskSort, setTaskSort] = useState<TaskSort>("dueAsc");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editingActiveStartTime, setEditingActiveStartTime] = useState(false);
  const [activeStartTimeInput, setActiveStartTimeInput] = useState("");
  const [duePickerOpen, setDuePickerOpen] = useState(false);
  const [duePickerMode, setDuePickerMode] = useState<DuePickerMode>("create");
  const [duePickerPosition, setDuePickerPosition] = useState<DuePickerPosition | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const duePickerRef = useRef<HTMLDivElement | null>(null);
  const dueTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dueEditTriggerRef = useRef<HTMLButtonElement | null>(null);
  const categoryMenuRef = useRef<HTMLDivElement | null>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const createCategoryMenuRef = useRef<HTMLDivElement | null>(null);
  const createCategoryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const categoryFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const categoryFilterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const taskSortMenuRef = useRef<HTMLDivElement | null>(null);
  const taskSortTriggerRef = useRef<HTMLButtonElement | null>(null);

  const elapsedSeconds = useTimer(activeEntry?.start_time ?? null);
  const activeTask = useMemo(
    () => tasks.find((task) => task.id === activeEntry?.task_id) ?? null,
    [tasks, activeEntry]
  );

  const filteredPendingTasks = useMemo(() => {
    return tasks
      .filter((task) => task.status === "pending")
      .filter((task) => (categoryFilter === "all" ? true : task.category === categoryFilter))
      .filter((task) => matchesDueFilter(task, dueFilter));
  }, [tasks, categoryFilter, dueFilter]);

  const groupedTasks = useMemo(() => {
    const groups: Record<SectionKey, Task[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      completed: []
    };

    for (const task of tasks) {
      if (categoryFilter !== "all" && task.category !== categoryFilter) {
        continue;
      }

      if (task.status !== "pending") {
        groups.completed.push(task);
        continue;
      }

      if (!matchesDueFilter(task, dueFilter)) {
        continue;
      }

      if (isOverdue(task.due_at)) {
        groups.overdue.push(task);
      } else if (isToday(task.due_at)) {
        groups.today.push(task);
      } else {
        groups.upcoming.push(task);
      }
    }

    groups.overdue.sort((a, b) => compareTasks(a, b, taskSort));
    groups.today.sort((a, b) => compareTasks(a, b, taskSort));
    groups.upcoming.sort((a, b) => compareTasks(a, b, taskSort));
    groups.completed.sort((a, b) => compareTasks(a, b, taskSort));
    return groups;
  }, [tasks, categoryFilter, dueFilter, taskSort]);

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);

  async function refreshTasks() {
    const data = await api.listTasks();
    setTasks(data);
  }

  async function refreshCategories() {
    const data = await api.listCategories();
    setCategories(data);
    setForm((prev) => {
      if (data.length === 0) return { ...prev, category: "" };
      if (prev.category && data.some((category) => category.name === prev.category)) return prev;
      return { ...prev, category: data[0].name };
    });
  }

  async function syncActiveEntry() {
    const response = await api.getActiveTimer();
    setActiveEntry(response.active_entry);
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
    if (!activeEntry) {
      setEditingActiveStartTime(false);
      setActiveStartTimeInput("");
      return;
    }

    setActiveStartTimeInput(toDateTimeLocalValue(activeEntry.start_time));
  }, [activeEntry]);

  useEffect(() => {
    if (!duePickerOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (duePickerRef.current?.contains(target)) return;
      if (dueTriggerRef.current?.contains(target)) return;
      if (dueEditTriggerRef.current?.contains(target)) return;
      setDuePickerOpen(false);
      setTimePickerOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDuePickerOpen(false);
        setTimePickerOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [duePickerOpen]);

  useEffect(() => {
    if (!editingCategoryTaskId) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (categoryMenuRef.current?.contains(target)) return;
      if (categoryTriggerRef.current?.contains(target)) return;
      setEditingCategoryTaskId(null);
      setEditingCategoryValue("");
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setEditingCategoryTaskId(null);
        setEditingCategoryValue("");
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [editingCategoryTaskId]);

  useEffect(() => {
    if (!createCategoryMenuOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (createCategoryMenuRef.current?.contains(target)) return;
      if (createCategoryTriggerRef.current?.contains(target)) return;
      setCreateCategoryMenuOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCreateCategoryMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [createCategoryMenuOpen]);

  useEffect(() => {
    if (!categoryFilterMenuOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (categoryFilterMenuRef.current?.contains(target)) return;
      if (categoryFilterTriggerRef.current?.contains(target)) return;
      setCategoryFilterMenuOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCategoryFilterMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [categoryFilterMenuOpen]);

  useEffect(() => {
    if (!taskSortMenuOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (taskSortMenuRef.current?.contains(target)) return;
      if (taskSortTriggerRef.current?.contains(target)) return;
      setTaskSortMenuOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setTaskSortMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [taskSortMenuOpen]);

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title || !form.category) return;

    setLoading(true);
    setError("");
    try {
      await api.createTask({
        title: form.title,
        category: form.category,
        due_at: combineDueDateTime(form.due_at, form.due_time),
        status: form.status
      });
      setForm((prev) => ({ ...initialForm, category: prev.category }));
      setDuePickerOpen(false);
      setTimePickerOpen(false);
      await refreshTasks();
      await refreshCategories();
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
      setError(message);
      await syncActiveEntry();
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
      setError(err instanceof Error ? err.message : "開始時刻の更新に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete(taskId: number) {
    setLoading(true);
    setError("");
    try {
      await api.updateTask(taskId, { status: "completed" });
      setAnimatingCompleteTaskIds((prev) => [...new Set([...prev, taskId])]);
      window.setTimeout(() => {
        setAnimatingCompleteTaskIds((prev) => prev.filter((id) => id !== taskId));
      }, 650);
      if (activeEntry?.task_id === taskId) setActiveEntry(null);
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "タスク更新に失敗しました");
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
      setError(err instanceof Error ? err.message : "タスク更新に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(taskId: number): Promise<boolean> {
    setLoading(true);
    setError("");
    try {
      await api.deleteTask(taskId);
      if (activeEntry?.task_id === taskId) setActiveEntry(null);
      await refreshTasks();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "タスク削除に失敗しました");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveTaskTitle(task: Task) {
    const nextTitle = editingTitleValue.trim();
    if (!nextTitle) {
      setEditingTitleTaskId(null);
      setEditingTitleValue("");
      return;
    }
    if (nextTitle === task.title) {
      setEditingTitleTaskId(null);
      setEditingTitleValue("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api.updateTask(task.id, {
        title: nextTitle
      });
      setEditingTitleTaskId(null);
      setEditingTitleValue("");
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "タイトル更新に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveTaskDue(task: Task, nextDueDate?: string) {
    const dueDate = (nextDueDate ?? editingDueValue).trim();
    const nextDueAt = dueDate ? combineDueDateTime(dueDate, editingDueTimeValue) : null;
    if (nextDueAt === task.due_at) {
      setEditingDueTaskId(null);
      setEditingDueValue("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api.updateTask(task.id, {
        due_at: nextDueAt
      });
      setEditingDueTaskId(null);
      setEditingDueValue("");
      setEditingDueTimeValue("");
      setDuePickerOpen(false);
      setTimePickerOpen(false);
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "期限更新に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function openCreateDuePicker() {
    setDuePickerMode("create");
    setDuePickerPosition(null);
    setTimePickerOpen(false);
    setDuePickerOpen((open) => !open);
  }

  function openTaskDuePicker(task: Task, anchor: HTMLButtonElement) {
    dueEditTriggerRef.current = anchor;
    setDuePickerMode("task");
    setEditingDueTaskId(task.id);
    setEditingDueValue(toLocalDateInputValue(task.due_at));
    setEditingDueTimeValue(toLocalTimeValue(task.due_at));
    const due = parseDueMs(task.due_at);
    const baseDate = due === null ? new Date() : new Date(due);
    setCalendarMonth(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
    const rect = anchor.getBoundingClientRect();
    const pickerWidth = 380;
    const margin = 12;
    const left = Math.max(
      margin,
      Math.min(rect.left, window.innerWidth - pickerWidth - margin)
    );
    setDuePickerPosition({
      top: rect.bottom + 10,
      left
    });
    setTimePickerOpen(false);
    setDuePickerOpen(true);
  }

  const currentDueDate = duePickerMode === "create" ? form.due_at : editingDueValue;
  const currentDueTime = duePickerMode === "create" ? form.due_time : editingDueTimeValue;

  function setCurrentDueDate(value: string) {
    if (duePickerMode === "create") {
      setForm((prev) => ({ ...prev, due_at: value }));
      return;
    }
    setEditingDueValue(value);
  }

  function setCurrentDueTime(value: string) {
    if (duePickerMode === "create") {
      setForm((prev) => ({ ...prev, due_time: value }));
      return;
    }
    setEditingDueTimeValue(value);
  }

  function clearCurrentDue() {
    if (duePickerMode === "create") {
      setForm((prev) => ({ ...prev, due_at: "", due_time: "" }));
      return;
    }
    setEditingDueValue("");
    setEditingDueTimeValue("");
  }

  async function handleSaveTaskCategory(task: Task, nextCategory?: string) {
    const category = (nextCategory ?? editingCategoryValue).trim();
    if (!category || category === task.category) {
      setEditingCategoryTaskId(null);
      setEditingCategoryValue("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api.updateTask(task.id, {
        category
      });
      setEditingCategoryTaskId(null);
      setEditingCategoryValue("");
      await refreshTasks();
      await refreshCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "カテゴリ更新に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  const selectedDue = currentDueDate ? new Date(`${currentDueDate}T00:00:00`) : null;
  const pendingCount = filteredPendingTasks.length;

  return (
    <div className="space-y-5 pb-8">
      {deleteConfirmTask ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setDeleteConfirmTask(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-6 shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-semibold text-[color:var(--text)]">タスクを削除しますか</p>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              「{deleteConfirmTask.title}」を削除すると、関連する作業ログも含めて元に戻せません。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-full bg-white/8 px-4 py-2 text-sm font-medium text-[color:var(--text)] hover:bg-white/12"
                onClick={() => setDeleteConfirmTask(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="rounded-full bg-[color:var(--danger-soft)] px-4 py-2 text-sm font-medium text-[color:var(--danger)]"
                onClick={async () => {
                  const ok = await handleDelete(deleteConfirmTask.id);
                  if (ok) setDeleteConfirmTask(null);
                }}
              >
                削除
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 py-5 shadow-[var(--shadow)] sm:px-7 sm:py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-[color:var(--muted)] hover:bg-white/6"
            >
              <IconMenu />
            </button>
            <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-[color:var(--text)]">今日</h1>
          </div>

          <div className="flex items-center gap-2 text-[color:var(--muted)]">
            <Link
              href="/dashboard"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent hover:bg-white/6"
            >
              <IconIdea />
            </Link>
            <Link
              href="/time-entries"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent hover:bg-white/6"
            >
              <IconSidebar />
            </Link>
            <Link
              href="/categories"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent hover:bg-white/6"
            >
              <IconDots />
            </Link>
          </div>
        </div>

        <form className="relative mt-6" onSubmit={handleCreateTask}>
          <div className="rounded-[20px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[16px] px-3 py-2.5">
                <span className="text-[color:var(--muted)]">
                  <IconPlus />
                </span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="タスクを追加する"
                  className="min-w-0 flex-1 bg-transparent text-[17px] text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <button
                    ref={createCategoryTriggerRef}
                    type="button"
                    disabled={categories.length === 0}
                    onClick={() => setCreateCategoryMenuOpen((open) => !open)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium ${
                      createCategoryMenuOpen
                        ? "border-[color:var(--line-strong)] bg-white/8 text-[color:var(--text)]"
                        : "border-[color:var(--line)] bg-white/[0.04] text-[color:var(--muted)] hover:border-[color:var(--line-strong)] hover:bg-white/[0.06]"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <span>{categories.length === 0 ? "カテゴリ未設定" : form.category}</span>
                    <span className="text-[color:var(--muted)]">
                      <IconChevronRight />
                    </span>
                  </button>

                  {createCategoryMenuOpen && categories.length > 0 ? (
                    <div
                      ref={createCategoryMenuRef}
                      className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-[160px] rounded-[16px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] py-2 shadow-[var(--shadow)]"
                    >
                      {categories.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                            form.category === category.name ? "text-[color:var(--accent-strong)]" : "text-[color:var(--text)]"
                          } hover:bg-white/6`}
                          onClick={() => {
                            setForm((prev) => ({ ...prev, category: category.name }));
                            setCreateCategoryMenuOpen(false);
                          }}
                        >
                          <span>{category.name}</span>
                          {form.category === category.name ? <IconCheck /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  ref={dueTriggerRef}
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white/5 px-3 py-2 text-sm text-[color:var(--text)] hover:bg-white/10"
                  onClick={openCreateDuePicker}
                >
                  <IconCalendar />
                  <span>
                    {form.due_at
                      ? formatDueAt(combineDueDateTime(form.due_at, form.due_time))
                      : "期限"}
                  </span>
                </button>

                <button
                  type="submit"
                  disabled={loading || categories.length === 0 || !form.title}
                  className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--accent-strong)] disabled:opacity-50"
                >
                  追加
                </button>
              </div>
            </div>
          </div>

          {duePickerOpen ? (
            <div
              ref={duePickerRef}
              className={`z-30 w-full max-w-[380px] rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4 shadow-[var(--shadow)] ${
                duePickerMode === "task" ? "fixed" : "absolute right-0 top-[calc(100%+10px)]"
              }`}
              style={
                duePickerMode === "task" && duePickerPosition
                  ? { top: duePickerPosition.top, left: duePickerPosition.left }
                  : undefined
              }
            >
              <div className="grid grid-cols-2 gap-2 rounded-[16px] bg-white/5 p-1">
                <button type="button" className="rounded-[12px] bg-white/8 px-4 py-2.5 text-sm font-medium text-[color:var(--text)]">
                  期日
                </button>
                <button type="button" className="rounded-[12px] px-4 py-2.5 text-sm font-medium text-[color:var(--muted)]">
                  期間
                </button>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 text-[color:var(--text)]">
                <button
                  type="button"
                  className="flex flex-col items-center gap-2 rounded-[14px] px-2 py-2.5 text-sm hover:bg-white/6"
                  onClick={() => setCurrentDueDate(getTodayDateString())}
                >
                  <span className="text-[color:var(--muted)]">
                    <IconSpark />
                  </span>
                  <span>今日</span>
                </button>
                <button
                  type="button"
                  className="flex flex-col items-center gap-2 rounded-[14px] px-2 py-2.5 text-sm hover:bg-white/6"
                  onClick={() => setCurrentDueDate(getTodayDateString(1))}
                >
                  <span className="text-[color:var(--muted)]">
                    <IconIdea />
                  </span>
                  <span>明日</span>
                </button>
                <button
                  type="button"
                  className="flex flex-col items-center gap-2 rounded-[14px] px-2 py-2.5 text-sm hover:bg-white/6"
                  onClick={() => setCurrentDueDate(getTodayDateString(7))}
                >
                  <span className="text-[color:var(--muted)]">
                    <IconCalendar />
                  </span>
                  <span>+7日</span>
                </button>
                <button
                  type="button"
                  className="flex flex-col items-center gap-2 rounded-[14px] px-2 py-2.5 text-sm hover:bg-white/6"
                  onClick={clearCurrentDue}
                >
                  <span className="text-[color:var(--muted)]">
                    <IconClock />
                  </span>
                  <span>なし</span>
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-[15px] font-medium tracking-[-0.02em] text-[color:var(--text)]">
                  {formatMonthLabel(calendarMonth)}
                </p>
                <div className="flex items-center gap-1 text-[color:var(--muted)]">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/8"
                    onClick={() =>
                      setCalendarMonth(
                        (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                      )
                    }
                  >
                    <IconChevronLeft />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/8"
                    onClick={() =>
                      setCalendarMonth(
                        (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                      )
                    }
                  >
                    <IconChevronRight />
                  </button>
                </div>
              </div>

                <div className="mt-4 grid grid-cols-7 gap-y-2 text-center text-xs text-[color:var(--muted)]">
                {weekLabels.map((label) => (
                  <div key={label}>{label}</div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
                {calendarDays.map((day) => {
                  const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                  const isSelected = selectedDue ? isSameDate(day, selectedDue) : false;
                  const isCurrentDay = isSameDate(day, new Date());

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-[14px] transition ${
                        isSelected
                          ? "bg-[color:var(--accent)] text-white"
                          : isCurrentDay
                          ? "bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                          : isCurrentMonth
                              ? "text-[color:var(--text)] hover:bg-white/8"
                              : "text-[color:var(--muted)] hover:bg-white/6"
                      }`}
                      onClick={() => setCurrentDueDate(toDateKey(day))}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2 border-t border-white/8 pt-4 text-[color:var(--text)]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-[18px] px-1 py-1.5 text-left hover:bg-white/4"
                  onClick={() => setTimePickerOpen((open) => !open)}
                >
                  <span className="inline-flex items-center gap-2 text-sm">
                    <IconClock />
                    時刻
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm text-[color:var(--muted)]">
                    {currentDueTime || "未設定"}
                    <IconChevronRight />
                  </span>
                </button>
                {timePickerOpen ? (
                  <div className="rounded-[18px] border border-[color:var(--line)] bg-white/4 py-2">
                    <div className="max-h-56 overflow-y-auto">
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm ${
                          currentDueTime === "" ? "text-[color:var(--accent-strong)]" : "text-[color:var(--text)]"
                        }`}
                        onClick={() => setCurrentDueTime("")}
                      >
                        <span>時刻なし</span>
                        {currentDueTime === "" ? <IconCheck /> : null}
                      </button>
                      {dueTimeOptions.map((time) => (
                        <button
                          key={time}
                          type="button"
                          className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm ${
                            currentDueTime === time ? "text-[color:var(--accent-strong)]" : "text-[color:var(--text)]"
                          }`}
                          onClick={() => setCurrentDueTime(time)}
                        >
                          <span>{time}</span>
                          {currentDueTime === time ? <IconCheck /> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center justify-between rounded-[18px] px-1 py-1.5">
                  <span className="inline-flex items-center gap-2 text-sm">
                    <IconSpark />
                    リマインダー
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm text-[color:var(--muted)]">
                    未設定
                    <IconChevronRight />
                  </span>
                </div>
              </div>

              <div className="mt-4 flex justify-between gap-3">
                <button
                  type="button"
                  className="rounded-[16px] border border-[color:var(--line)] px-5 py-2.5 text-sm font-medium text-[color:var(--text)] hover:bg-white/6"
                  onClick={clearCurrentDue}
                >
                  クリア
                </button>
                <button
                  type="button"
                  className="rounded-[16px] bg-[color:var(--accent)] px-7 py-2.5 text-sm font-medium text-white hover:bg-[color:var(--accent-strong)]"
                  onClick={() => {
                    if (duePickerMode === "task") {
                      const task = tasks.find((item) => item.id === editingDueTaskId);
                      if (task) {
                        void handleSaveTaskDue(task);
                        return;
                      }
                    }
                    setDuePickerOpen(false);
                    setTimePickerOpen(false);
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          ) : null}
        </form>

        {error ? (
          <p className="mt-4 rounded-[18px] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">{error}</p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="flex flex-wrap items-center gap-2 md:shrink-0">
            <button
              type="button"
              className={`rounded-full px-3 py-2 text-sm ${dueFilter === "all" ? "bg-white/10 text-[color:var(--text)]" : "bg-white/5 text-[color:var(--muted)] hover:bg-white/8"}`}
              onClick={() => setDueFilter("all")}
            >
              すべて
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-2 text-sm ${dueFilter === "today" ? "bg-white/10 text-[color:var(--text)]" : "bg-white/5 text-[color:var(--muted)] hover:bg-white/8"}`}
              onClick={() => setDueFilter("today")}
            >
              今日
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-2 text-sm ${dueFilter === "next7days" ? "bg-white/10 text-[color:var(--text)]" : "bg-white/5 text-[color:var(--muted)] hover:bg-white/8"}`}
              onClick={() => setDueFilter("next7days")}
            >
              7日以内
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end md:ml-auto md:flex-row md:flex-wrap md:items-center">
            <div className="rounded-full bg-white/5 px-3 py-2 text-sm text-[color:var(--muted)] sm:shrink-0">
              {pendingCount} 件
            </div>
            <div className="relative w-full sm:w-auto">
              <button
                ref={taskSortTriggerRef}
                type="button"
                onClick={() => setTaskSortMenuOpen((open) => !open)}
                className={`inline-flex w-full items-center justify-between gap-1 rounded-full border px-3 py-2 text-sm font-medium sm:w-auto ${
                  taskSortMenuOpen
                    ? "border-[color:var(--line-strong)] bg-white/8 text-[color:var(--text)]"
                    : "border-[color:var(--line)] bg-white/[0.04] text-[color:var(--muted)] hover:border-[color:var(--line-strong)] hover:bg-white/[0.06]"
                }`}
                aria-haspopup="menu"
                aria-expanded={taskSortMenuOpen}
              >
                <span>
                  {taskSort === "dueAsc"
                    ? "期限が近い順"
                    : taskSort === "dueDesc"
                      ? "期限が遠い順"
                      : taskSort === "createdDesc"
                        ? "新しい順"
                        : taskSort === "createdAsc"
                          ? "古い順"
                          : "名前順"}
                </span>
                <span className="text-[color:var(--muted)]">
                  <IconChevronRight />
                </span>
              </button>

              {taskSortMenuOpen ? (
                <div
                  ref={taskSortMenuRef}
                  className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-[180px] rounded-[16px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] py-2 shadow-[var(--shadow)]"
                >
                  {[
                    ["dueAsc", "期限が近い順"],
                    ["dueDesc", "期限が遠い順"],
                    ["createdDesc", "新しい順"],
                    ["createdAsc", "古い順"],
                    ["titleAsc", "名前順"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                        taskSort === value ? "text-[color:var(--accent-strong)]" : "text-[color:var(--text)]"
                      } hover:bg-white/6`}
                      onClick={() => {
                        setTaskSort(value as TaskSort);
                        setTaskSortMenuOpen(false);
                      }}
                    >
                      <span>{label}</span>
                      {taskSort === value ? <IconCheck /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="relative w-full sm:w-auto">
              <button
                ref={categoryFilterTriggerRef}
                type="button"
                onClick={() => setCategoryFilterMenuOpen((open) => !open)}
                className={`inline-flex w-full items-center justify-between gap-1 rounded-full border px-3 py-2 text-sm font-medium sm:w-auto ${
                  categoryFilterMenuOpen
                    ? "border-[color:var(--line-strong)] bg-white/8 text-[color:var(--text)]"
                    : "border-[color:var(--line)] bg-white/[0.04] text-[color:var(--muted)] hover:border-[color:var(--line-strong)] hover:bg-white/[0.06]"
                }`}
                aria-haspopup="menu"
                aria-expanded={categoryFilterMenuOpen}
              >
                <span>{categoryFilter === "all" ? "全カテゴリ" : categoryFilter}</span>
                <span className="text-[color:var(--muted)]">
                  <IconChevronRight />
                </span>
              </button>

              {categoryFilterMenuOpen ? (
                <div
                  ref={categoryFilterMenuRef}
                  className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-[180px] rounded-[16px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] py-2 shadow-[var(--shadow)]"
                >
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                      categoryFilter === "all" ? "text-[color:var(--accent-strong)]" : "text-[color:var(--text)]"
                    } hover:bg-white/6`}
                    onClick={() => {
                      setCategoryFilter("all");
                      setCategoryFilterMenuOpen(false);
                    }}
                  >
                    <span>全カテゴリ</span>
                    {categoryFilter === "all" ? <IconCheck /> : null}
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                        categoryFilter === category.name ? "text-[color:var(--accent-strong)]" : "text-[color:var(--text)]"
                      } hover:bg-white/6`}
                      onClick={() => {
                        setCategoryFilter(category.name);
                        setCategoryFilterMenuOpen(false);
                      }}
                    >
                      <span>{category.name}</span>
                      {categoryFilter === category.name ? <IconCheck /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow)] sm:p-4">
          {groupedTasks.overdue.length > 0 ? (
            <div className="mb-3">
              <SectionHeader title="遅延" count={groupedTasks.overdue.length} tone="danger" />
              <ul className="divide-y divide-white/[0.03]">
                {groupedTasks.overdue.map((task) => (
                  <li key={task.id}>
                    <TaskRow
                      task={task}
                      isActive={activeEntry?.task_id === task.id}
                      isAnimatingComplete={animatingCompleteTaskIds.includes(task.id)}
                      onStart={() => void handleStart(task.id)}
                      onStop={() => void handleStop(task.id)}
                      isEditingTitle={editingTitleTaskId === task.id}
                      editingTitleValue={editingTitleTaskId === task.id ? editingTitleValue : task.title}
                      onEditTitleStart={() => {
                        setEditingTitleTaskId(task.id);
                        setEditingTitleValue(task.title);
                      }}
                      onEditTitleChange={setEditingTitleValue}
                      onEditTitleCommit={() => void handleSaveTaskTitle(task)}
                      onEditTitleCancel={() => {
                        setEditingTitleTaskId(null);
                        setEditingTitleValue("");
                      }}
                      isEditingDue={editingDueTaskId === task.id}
                      onEditDueStart={(anchor) => openTaskDuePicker(task, anchor)}
                      isEditingCategory={editingCategoryTaskId === task.id}
                      editingCategoryValue={editingCategoryTaskId === task.id ? editingCategoryValue : task.category}
                      categoryOptions={categories.map((category) => category.name)}
                      categoryMenuRef={categoryMenuRef}
                      categoryTriggerRef={categoryTriggerRef}
                      onEditCategoryStart={() => {
                        setEditingCategoryTaskId(task.id);
                        setEditingCategoryValue(task.category);
                      }}
                      onEditCategoryChange={setEditingCategoryValue}
                      onEditCategoryCommit={(value) => void handleSaveTaskCategory(task, value)}
                      onEditCategoryCancel={() => {
                        setEditingCategoryTaskId(null);
                        setEditingCategoryValue("");
                      }}
                      onToggleComplete={() => void handleComplete(task.id)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mb-3">
            <SectionHeader title="今日" count={groupedTasks.today.length} />
            {groupedTasks.today.length === 0 ? (
              <div className="rounded-[22px] px-4 py-8 text-sm text-[color:var(--muted)]">今日のタスクはありません</div>
            ) : (
              <ul className="divide-y divide-white/[0.03]">
                {groupedTasks.today.map((task) => (
                  <li key={task.id}>
                    <TaskRow
                      task={task}
                      isActive={activeEntry?.task_id === task.id}
                      isAnimatingComplete={animatingCompleteTaskIds.includes(task.id)}
                      onStart={() => void handleStart(task.id)}
                      onStop={() => void handleStop(task.id)}
                      isEditingTitle={editingTitleTaskId === task.id}
                      editingTitleValue={editingTitleTaskId === task.id ? editingTitleValue : task.title}
                      onEditTitleStart={() => {
                        setEditingTitleTaskId(task.id);
                        setEditingTitleValue(task.title);
                      }}
                      onEditTitleChange={setEditingTitleValue}
                      onEditTitleCommit={() => void handleSaveTaskTitle(task)}
                      onEditTitleCancel={() => {
                        setEditingTitleTaskId(null);
                        setEditingTitleValue("");
                      }}
                      isEditingDue={editingDueTaskId === task.id}
                      onEditDueStart={(anchor) => openTaskDuePicker(task, anchor)}
                      isEditingCategory={editingCategoryTaskId === task.id}
                      editingCategoryValue={editingCategoryTaskId === task.id ? editingCategoryValue : task.category}
                      categoryOptions={categories.map((category) => category.name)}
                      categoryMenuRef={categoryMenuRef}
                      categoryTriggerRef={categoryTriggerRef}
                      onEditCategoryStart={() => {
                        setEditingCategoryTaskId(task.id);
                        setEditingCategoryValue(task.category);
                      }}
                      onEditCategoryChange={setEditingCategoryValue}
                      onEditCategoryCommit={(value) => void handleSaveTaskCategory(task, value)}
                      onEditCategoryCancel={() => {
                        setEditingCategoryTaskId(null);
                        setEditingCategoryValue("");
                      }}
                      onToggleComplete={() => void handleComplete(task.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mb-3">
            <SectionHeader title="今後" count={groupedTasks.upcoming.length} />
            {groupedTasks.upcoming.length === 0 ? (
              <div className="rounded-[22px] px-4 py-8 text-sm text-[color:var(--muted)]">今後のタスクはありません</div>
            ) : (
              <ul className="divide-y divide-white/[0.03]">
                {groupedTasks.upcoming.map((task) => (
                  <li key={task.id}>
                    <TaskRow
                      task={task}
                      isActive={activeEntry?.task_id === task.id}
                      isAnimatingComplete={animatingCompleteTaskIds.includes(task.id)}
                      onStart={() => void handleStart(task.id)}
                      onStop={() => void handleStop(task.id)}
                      isEditingTitle={editingTitleTaskId === task.id}
                      editingTitleValue={editingTitleTaskId === task.id ? editingTitleValue : task.title}
                      onEditTitleStart={() => {
                        setEditingTitleTaskId(task.id);
                        setEditingTitleValue(task.title);
                      }}
                      onEditTitleChange={setEditingTitleValue}
                      onEditTitleCommit={() => void handleSaveTaskTitle(task)}
                      onEditTitleCancel={() => {
                        setEditingTitleTaskId(null);
                        setEditingTitleValue("");
                      }}
                      isEditingDue={editingDueTaskId === task.id}
                      onEditDueStart={(anchor) => openTaskDuePicker(task, anchor)}
                      isEditingCategory={editingCategoryTaskId === task.id}
                      editingCategoryValue={editingCategoryTaskId === task.id ? editingCategoryValue : task.category}
                      categoryOptions={categories.map((category) => category.name)}
                      categoryMenuRef={categoryMenuRef}
                      categoryTriggerRef={categoryTriggerRef}
                      onEditCategoryStart={() => {
                        setEditingCategoryTaskId(task.id);
                        setEditingCategoryValue(task.category);
                      }}
                      onEditCategoryChange={setEditingCategoryValue}
                      onEditCategoryCommit={(value) => void handleSaveTaskCategory(task, value)}
                      onEditCategoryCancel={() => {
                        setEditingCategoryTaskId(null);
                        setEditingCategoryValue("");
                      }}
                      onToggleComplete={() => void handleComplete(task.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <SectionHeader title="完了" count={groupedTasks.completed.length} />
            {groupedTasks.completed.length === 0 ? (
              <div className="rounded-[22px] px-4 py-8 text-sm text-[color:var(--muted)]">完了したタスクはありません</div>
            ) : (
              <ul className="divide-y divide-white/[0.03]">
                {groupedTasks.completed.map((task) => (
                  <li key={task.id}>
                    <TaskRow
                      task={task}
                      isActive={false}
                      isAnimatingComplete={false}
                      onStart={() => undefined}
                      onStop={() => undefined}
                      isEditingTitle={editingTitleTaskId === task.id}
                      editingTitleValue={editingTitleTaskId === task.id ? editingTitleValue : task.title}
                      onEditTitleStart={() => {
                        setEditingTitleTaskId(task.id);
                        setEditingTitleValue(task.title);
                      }}
                      onEditTitleChange={setEditingTitleValue}
                      onEditTitleCommit={() => void handleSaveTaskTitle(task)}
                      onEditTitleCancel={() => {
                        setEditingTitleTaskId(null);
                        setEditingTitleValue("");
                      }}
                      isEditingDue={editingDueTaskId === task.id}
                      onEditDueStart={(anchor) => openTaskDuePicker(task, anchor)}
                      isEditingCategory={editingCategoryTaskId === task.id}
                      editingCategoryValue={editingCategoryTaskId === task.id ? editingCategoryValue : task.category}
                      categoryOptions={categories.map((category) => category.name)}
                      categoryMenuRef={categoryMenuRef}
                      categoryTriggerRef={categoryTriggerRef}
                      onEditCategoryStart={() => {
                        setEditingCategoryTaskId(task.id);
                        setEditingCategoryValue(task.category);
                      }}
                      onEditCategoryChange={setEditingCategoryValue}
                      onEditCategoryCommit={(value) => void handleSaveTaskCategory(task, value)}
                      onEditCategoryCancel={() => {
                        setEditingCategoryTaskId(null);
                        setEditingCategoryValue("");
                      }}
                      onToggleComplete={() => void handleReopen(task.id)}
                      onDelete={() => setDeleteConfirmTask(task)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[34px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)]">
            <p className="text-sm text-[color:var(--muted)]">進行中</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--text)]">
              {activeTask ? activeTask.title : "待機中"}
            </h2>
            <p className="mt-4 text-[40px] font-semibold tracking-[-0.05em] text-[color:var(--text)]">
              {formatSeconds(elapsedSeconds)}
            </p>
            <div className="mt-4 h-2 rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#4f7cff,#86a7ff)]"
                style={{ width: activeTask ? `${Math.min(100, (elapsedSeconds / 7200) * 100)}%` : "0%" }}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/6 px-2.5 py-1 text-[color:var(--muted)]">
                {activeTask ? activeTask.category : "カテゴリ未選択"}
              </span>
              <span className="rounded-full bg-white/6 px-2.5 py-1 text-[color:var(--muted)]">
                {activeTask ? formatDueAt(activeTask.due_at) : "期限未設定"}
              </span>
            </div>
            {activeEntry ? (
              <div className="mt-5 space-y-3">
                <p className="text-sm text-[color:var(--muted)]">開始 {formatStartTime(activeEntry.start_time)}</p>
                {editingActiveStartTime ? (
                  <div className="space-y-2">
                    <input
                      type="datetime-local"
                      value={activeStartTimeInput}
                      max={toDateTimeLocalValue(new Date().toISOString())}
                      onChange={(event) => setActiveStartTimeInput(event.target.value)}
                      className="w-full rounded-[18px] border border-[color:var(--line)] bg-white/5 px-4 py-3 text-sm text-[color:var(--text)] focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white"
                        onClick={() => void handleUpdateActiveStartTime()}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-white/8 px-4 py-2 text-sm font-medium text-[color:var(--text)]"
                        onClick={() => setEditingActiveStartTime(false)}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-white/8 px-4 py-2 text-sm font-medium text-[color:var(--text)] hover:bg-white/12"
                      onClick={() => setEditingActiveStartTime(true)}
                    >
                      開始時刻を修正
                    </button>
                    {activeTask ? (
                      <button
                        type="button"
                        className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--accent-strong)]"
                        onClick={() => void handleStop(activeTask.id)}
                      >
                        停止
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-5 text-sm leading-6 text-[color:var(--muted)]">
                タスクを開始すると、ここに実行中の情報が表示されます。
              </p>
            )}
          </section>

          <section className="rounded-[34px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)]">
            <p className="text-sm text-[color:var(--muted)]">サマリー</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-[18px] bg-white/4 px-4 py-3">
                <span className="text-sm text-[color:var(--muted)]">未完了</span>
                <span className="text-lg font-semibold text-[color:var(--text)]">{filteredPendingTasks.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-[18px] bg-white/4 px-4 py-3">
                <span className="text-sm text-[color:var(--muted)]">完了</span>
                <span className="text-lg font-semibold text-[color:var(--text)]">{groupedTasks.completed.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-[18px] bg-white/4 px-4 py-3">
                <span className="text-sm text-[color:var(--muted)]">期限超過</span>
                <span className="text-lg font-semibold text-[color:var(--danger)]">{groupedTasks.overdue.length}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
