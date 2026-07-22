// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationViewModel } from "@/features/notifications/notificationTypes";
import NotificationsPage from "./page";

const mocks = vi.hoisted(() => ({ items: [] as NotificationViewModel[], role: "GENERAL_USER", replace: vi.fn(), push: vi.fn() }));
const searchParams = new URLSearchParams();

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }), useSearchParams: () => searchParams }));
vi.mock("@/components/landing/LandingHeader", () => ({ LandingHeader: () => <header data-testid="landing-header" /> }));
vi.mock("@/components/auth/AuthContext", () => ({
  useAuth: () => ({ user: { publicId: "user-1", name: "사용자", role: mocks.role, roles: [mocks.role], email: "user@example.com", apiPermissions: [], uiRoles: [], uiPermissions: [] } }),
}));
vi.mock("@/features/notifications/NotificationContext", () => ({
  useNotifications: () => ({
    items: mocks.items,
    unreadCount: mocks.items.filter(item => !item.read).length,
    actionCount: mocks.items.filter(item => item.action_required).length,
    loading: false,
    error: "",
    refresh: vi.fn(),
    markRead: vi.fn(async () => true),
    markAllRead: vi.fn(async () => true),
    targetFor: vi.fn(() => "/control/incidents/incident-1"),
    realtimeStatus: "unavailable",
  }),
}));

const item = (publicId: string, title: string, read: boolean): NotificationViewModel => ({
  public_id: publicId,
  notification_type: "INCIDENT_STATUS_CHANGED",
  severity: "INFO",
  title,
  body: "서비스 알림 본문",
  resource: { resource_type: "INCIDENT", resource_public_id: "incident-1", resource_label: "INC-1" },
  resource_label: "INC-1",
  target_path: "/control/incidents/incident-1",
  delivery_status: "DELIVERED",
  read,
  delivered_at: "2026-07-22T01:00:00Z",
  read_at: read ? "2026-07-22T02:00:00Z" : null,
  created_at: "2026-07-22T01:00:00Z",
  action_required: true,
  action_label: "사건 상세 보기",
  reason: "UPDATE_ONLY",
  state_label: "상태 업데이트",
  evidence: { kind: "CCTV", camera: "CAM-01", location: "테스트 교차로", objectLabel: "위험 객체", confidence: 91, imagePath: "/evidence.jpg" },
});

beforeEach(() => {
  mocks.items = [item("read", "읽은 계정 안내", true), item("unread", "읽지 않은 계정 안내", false)];
  mocks.role = "GENERAL_USER";
  mocks.replace.mockClear();
  mocks.push.mockClear();
  searchParams.delete("tab");
});

afterEach(cleanup);

describe("notifications page audience presentation", () => {
  it("shows only account-service content and read metadata to general users", () => {
    render(<NotificationsPage />);
    const tabs = screen.getByRole("tablist", { name: "알림 보기" });
    const queue = document.getElementById("notification-queue")!;

    expect(within(tabs).getByRole("tab", { name: /전체 알림/ })).toBeInTheDocument();
    expect(within(tabs).getByRole("tab", { name: /읽지 않음/ })).toBeInTheDocument();
    expect(within(tabs).queryByRole("tab", { name: /처리 필요/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("중요도")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("유형")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("정렬")).not.toBeInTheDocument();
    expect(within(queue).getByText("읽은 계정 안내")).toBeInTheDocument();
    expect(within(queue).getByText("읽지 않은 계정 안내")).toBeInTheDocument();
    expect(within(queue).getAllByText("서비스 알림 본문")).toHaveLength(2);
    expect(queue.querySelector("time[datetime='2026-07-22T01:00:00Z']")).toBeInTheDocument();
    expect(queue.querySelectorAll("em")).toHaveLength(2);
    expect(within(queue).queryByText("INC-1")).not.toBeInTheDocument();
    expect(within(queue).queryByText("일반")).not.toBeInTheDocument();
    expect(within(queue).queryByText(/조치 필요|상태 업데이트|처리됨/)).not.toBeInTheDocument();

    const detail = screen.getByText("알림 상세").closest("aside")!;
    expect(within(detail).getByRole("heading", { name: "읽은 계정 안내" })).toBeInTheDocument();
    expect(within(detail).getByText("서비스 알림 본문")).toBeInTheDocument();
    expect(within(detail).getByText("읽음")).toBeInTheDocument();
    expect(detail.querySelector("time[datetime='2026-07-22T01:00:00Z']")).toBeInTheDocument();
    expect(within(detail).queryByText("사건 상태 변경")).not.toBeInTheDocument();
    expect(within(detail).queryByText("일반")).not.toBeInTheDocument();
    expect(within(detail).queryByText("상태 업데이트")).not.toBeInTheDocument();
    expect(within(detail).queryByText("사건 정보")).not.toBeInTheDocument();
    expect(within(detail).queryByText("AI 탐지 근거")).not.toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: "사건 열기" })).not.toBeInTheDocument();

    fireEvent.click(within(tabs).getByRole("tab", { name: /읽지 않음/ }));
    expect(within(queue).queryByText("읽은 계정 안내")).not.toBeInTheDocument();
    expect(within(queue).getByText("읽지 않은 계정 안내")).toBeInTheDocument();
  });

  it("keeps operations metadata, evidence, filters, and actions for controllers", () => {
    mocks.role = "CONTROLLER";
    mocks.items = [item("operation", "운영 사건 알림", false)];
    render(<NotificationsPage />);

    expect(screen.getByRole("tab", { name: /처리 필요/ })).toBeInTheDocument();
    expect(screen.getByLabelText("중요도")).toBeInTheDocument();
    expect(screen.getByLabelText("유형")).toBeInTheDocument();
    expect(screen.getAllByText("INC-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("일반").length).toBeGreaterThan(0);
    expect(screen.getAllByText("상태 업데이트").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "사건 상태 변경" })).toBeInTheDocument();
    expect(screen.getByText("사건 정보")).toBeInTheDocument();
    expect(screen.getByText("AI 탐지 근거")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "사건 열기" })).toBeInTheDocument();
  });
});
