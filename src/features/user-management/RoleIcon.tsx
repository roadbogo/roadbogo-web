import type { UserRole } from "@/types/auth";

export type RoleIconKind = UserRole | "ALL" | "UNASSIGNED" | "MULTIPLE";

export function RoleIcon({ kind, className }: { kind: RoleIconKind; className?: string }) {
  const common = { viewBox: "0 0 24 24", "aria-hidden": true, className };
  if (kind === "SYSTEM_ADMIN") return <svg {...common}><path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>;
  if (kind === "CONTROL_MANAGER") return <svg {...common}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>;
  if (kind === "CONTROLLER") return <svg {...common}><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4m-5-10 3-3 3 2 4-4"/></svg>;
  if (kind === "RESPONDER") return <svg {...common}><path d="M5 16V9a7 7 0 0 1 14 0v7M3 16h18M8 20h8"/><path d="M12 2v2M5 4l2 2M19 4l-2 2"/></svg>;
  if (kind === "GENERAL_USER") return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
  if (kind === "UNASSIGNED") return <svg {...common}><path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z"/><path d="M9.7 9a2.4 2.4 0 1 1 3.7 2c-.9.5-1.4 1-1.4 2M12 17h.01"/></svg>;
  if (kind === "MULTIPLE") return <svg {...common}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 7 4.5"/></svg>;
  return <svg {...common}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 7 4.5"/></svg>;
}
