// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationViewModel } from "@/features/notifications/notificationTypes";
import NotificationsPage from "./page";

const mocks = vi.hoisted(() => ({ items: [] as NotificationViewModel[], replace: vi.fn() }));
const searchParams = new URLSearchParams();

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: mocks.replace }), useSearchParams: () => searchParams }));
vi.mock("@/components/landing/LandingHeader", () => ({ LandingHeader: () => <header data-testid="landing-header" /> }));
vi.mock("@/components/auth/AuthContext", () => ({
  useAuth: () => ({ user: { publicId: "user-1", name: "사용자", role: "GENERAL_USER", roles: ["GENERAL_USER"], email: "user@example.com", apiPermissions: [], uiRoles: [], uiPermissions: [] } }),
}));
vi.mock("@/features/notifications/NotificationContext", () => ({
  useNotifications: () => ({
    items: mocks.items,
    unreadCount: mocks.items.filter(item => !item.read).length,
    actionCount: 0,
    loading: false,
    error: "",
    refresh: vi.fn(),
    markRead: vi.fn(async () => true),
    markAllRead: vi.fn(async () => true),
    targetFor: vi.fn(() => null),
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
  target_path: null,
  delivery_status: "DELIVERED",
  read,
  delivered_at: "2026-07-22T01:00:00Z",
  read_at: read ? "2026-07-22T02:00:00Z" : null,
  created_at: "2026-07-22T01:00:00Z",
  action_required: false,
  action_label: null,
  reason: "UPDATE_ONLY",
  state_label: "상태 업데이트",
});

beforeEach(() => {
  mocks.items = [item("read", "읽은 계정 안내", true), item("unread", "읽지 않은 계정 안내", false)];
  mocks.replace.mockClear();
  searchParams.delete("tab");
});

afterEach(cleanup);

describe("general-user notifications page", () => {
  it("keeps all/unread tabs while hiding operations tabs and filters", () => {
    render(<NotificationsPage />);
    const tabs = screen.getByRole("tablist", { name: "알림 보기" });

    expect(within(tabs).getByRole("tab", { name: /전체 알림/ })).toBeInTheDocument();
    expect(within(tabs).getByRole("tab", { name: /읽지 않음/ })).toBeInTheDocument();
    expect(within(tabs).queryByRole("tab", { name: /처리 필요/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("중요도")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("유형")).not.toBeInTheDocument();

    const queue = document.getElementById("notification-queue")!;
    expect(within(queue).getByText("읽은 계정 안내")).toBeInTheDocument();
    expect(within(queue).getByText("읽지 않은 계정 안내")).toBeInTheDocument();

    fireEvent.click(within(tabs).getByRole("tab", { name: /읽지 않음/ }));
    expect(within(queue).queryByText("읽은 계정 안내")).not.toBeInTheDocument();
    expect(within(queue).getByText("읽지 않은 계정 안내")).toBeInTheDocument();
  });
});
