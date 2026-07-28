import type { DashboardIncident } from "@/features/control-dashboard/dashboardTypes";
import type { IncidentListQuery, IncidentListTab, IncidentManagementItem, IncidentSort, RiskFilter, StatusFilter } from "./incidentManagementTypes";
import { terminalStatuses } from "./incidentManagementTypes";

export const INCIDENT_PAGE_SIZE = 10;

export const sortOptions: { value: IncidentSort; label: string }[] = [
  { value: "priority,desc", label: "우선순위순" },
  { value: "first_detected_at,desc", label: "최신 발생순" },
  { value: "first_detected_at,asc", label: "오래된 발생순" },
  { value: "last_detected_at,desc", label: "최근 탐지순" },
  { value: "risk_score,desc", label: "위험도 높은순" },
];

export const statusGroups: Record<Exclude<StatusFilter, "ALL">, DashboardIncident["status"][]> = {
  OPEN: ["NEW", "ACKNOWLEDGED", "CLAIMED"],
  REVIEW: ["UNDER_REVIEW"],
  DISPATCH: ["DISPATCH_REQUESTED", "DISPATCHED", "ON_SCENE", "ACTION_IN_PROGRESS"],
  DONE: ["ACTION_COMPLETED", "CLOSED", "FALSE_POSITIVE"],
};

export function isArchiveEligible(item: Pick<DashboardIncident, "status">) {
  return terminalStatuses.includes(item.status);
}

export function kstDateBoundaryToUtc(date: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const suffix = endOfDay ? "T23:59:59.999+09:00" : "T00:00:00.000+09:00";
  const parsed = new Date(`${date}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function formatDateRange(from?: string, to?: string) {
  if (!from || !to) return "발생 기간 · 전체";
  const format = (value: string) => value.replaceAll("-", ".");
  return `${format(from)} ~ ${format(to)}`;
}

export function utcBoundaryToKstDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function safeTime(value: string) {
  const time = Date.parse(value);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

export function filterAndSortIncidents(items: IncidentManagementItem[], query: IncidentListQuery, archivedIds: Set<string>) {
  const keyword = query.keyword.trim().toLocaleLowerCase("ko-KR");
  const from = query.from ? Date.parse(query.from) : Number.NEGATIVE_INFINITY;
  const to = query.to ? Date.parse(query.to) : Number.POSITIVE_INFINITY;
  const filtered = items.filter(item => {
    const archived = archivedIds.has(item.public_id);
    const terminal = isArchiveEligible(item);
    const tabMatch = query.tab === "archived" ? archived : query.tab === "closed" ? terminal && !archived : !terminal && !archived;
    const keywordMatch = !keyword || item.incident_no.toLocaleLowerCase("ko-KR").includes(keyword) || (item.class_name ?? "").toLocaleLowerCase("ko-KR").includes(keyword);
    const statusMatch = query.status === "ALL" || statusGroups[query.status].includes(item.status);
    const riskMatch = query.risk === "ALL" || item.current_risk_grade === query.risk;
    const detected = safeTime(item.first_detected_at);
    return tabMatch && keywordMatch && statusMatch && riskMatch && detected >= from && detected <= to;
  });
  const priority = (item: IncidentManagementItem) => ({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[item.current_risk_grade] * 1_000_000 + item.current_risk_score);
  return [...filtered].sort((a, b) => {
    switch (query.sort) {
      case "first_detected_at,desc": return safeTime(b.first_detected_at) - safeTime(a.first_detected_at);
      case "first_detected_at,asc": return safeTime(a.first_detected_at) - safeTime(b.first_detected_at);
      case "last_detected_at,desc": return safeTime(b.last_detected_at) - safeTime(a.last_detected_at);
      case "risk_score,desc": return b.current_risk_score - a.current_risk_score;
      default: return priority(b) - priority(a) || safeTime(b.first_detected_at) - safeTime(a.first_detected_at);
    }
  });
}

const validTabs = new Set<IncidentListTab>(["active", "closed", "archived"]);
const validSorts = new Set<IncidentSort>(sortOptions.map(option => option.value));
const validStatuses = new Set<StatusFilter>(["ALL", "OPEN", "REVIEW", "DISPATCH", "DONE"]);
const validRisks = new Set<RiskFilter>(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"]);

export function queryFromSearchParams(params: URLSearchParams): IncidentListQuery {
  const tab = params.get("tab") as IncidentListTab;
  const sort = params.get("sort") as IncidentSort;
  const status = params.get("status") as StatusFilter;
  const risk = params.get("risk") as RiskFilter;
  return {
    page: Math.max(1, Number(params.get("page")) || 1),
    size: INCIDENT_PAGE_SIZE,
    keyword: params.get("keyword") ?? "",
    tab: validTabs.has(tab) ? tab : "active",
    sort: validSorts.has(sort) ? sort : "priority,desc",
    status: validStatuses.has(status) ? status : "ALL",
    risk: validRisks.has(risk) ? risk : "ALL",
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
  };
}

export function queryToSearchParams(query: IncidentListQuery) {
  const params = new URLSearchParams();
  params.set("tab", query.tab);
  params.set("page", String(query.page));
  params.set("size", String(INCIDENT_PAGE_SIZE));
  if (query.keyword) params.set("keyword", query.keyword);
  if (query.status !== "ALL") params.set("status", query.status);
  if (query.risk !== "ALL") params.set("risk", query.risk);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.sort !== "priority,desc") params.set("sort", query.sort);
  return params;
}

export function visibleIncidentPages(page: number, totalPages: number, maximum = 5) {
  if (totalPages <= 0) return [];
  const count = Math.min(maximum, totalPages);
  const half = Math.floor(count / 2);
  const start = Math.min(Math.max(1, page - half), totalPages - count + 1);
  return Array.from({ length: count }, (_, index) => start + index);
}

export function incidentResultRange(page: number, size: number, totalElements: number) {
  if (totalElements <= 0) return "0건";
  const start = (page - 1) * size + 1;
  const end = Math.min(page * size, totalElements);
  return `${start}–${end} / 총 ${totalElements}건`;
}
