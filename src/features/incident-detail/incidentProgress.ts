import type { IncidentStatus } from "@/features/control-dashboard/dashboardTypes";

export type ProgressState = "done" | "current" | "pending" | "skipped";
export const progressStateLabel: Record<ProgressState, string> = { done: "완료", current: "현재", pending: "대기", skipped: "해당 없음" };

export function getCompactProgressStates(status: IncidentStatus): ProgressState[] {
  if (status === "CLOSED") return ["done", "done", "done", "done", "done", "done"];
  if (status === "FALSE_POSITIVE") return ["done", "done", "done", "skipped", "skipped", "done"];
  if (status === "ACTION_COMPLETED") return ["done", "done", "done", "done", "done", "pending"];
  const current = status === "NEW" ? 0 : status === "ACKNOWLEDGED" ? 1 : ["CLAIMED", "UNDER_REVIEW"].includes(status) ? 2 : ["DISPATCH_REQUESTED", "DISPATCHED"].includes(status) ? 3 : 4;
  return Array.from({ length: 6 }, (_, index) => index < current ? "done" : index === current ? "current" : "pending");
}
