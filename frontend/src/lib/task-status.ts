import { TaskStatus } from "@/lib/api";

export function toTaskStatusLabel(status: TaskStatus): string {
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
