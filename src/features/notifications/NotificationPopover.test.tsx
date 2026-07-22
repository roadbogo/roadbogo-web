// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationViewModel } from "./notificationTypes";
import { NotificationPopover } from "./NotificationPopover";

const mocks = vi.hoisted(() => ({
  role: "GENERAL_USER",
  items: [] as NotificationViewModel[],
  markRead: vi.fn(async () => true),
  push: vi.fn(),
  targetFor: vi.fn(() => null as string | null),
}));

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/components/auth/AuthContext", () => ({
  useAuth: () => ({ user: { publicId: "user-1", name: "사용자", role: mocks.role, roles: [mocks.role], email: "user@example.com", apiPermissions: [], uiRoles: [], uiPermissions: [] } }),
}));
vi.mock("./NotificationContext", () => ({
  useNotifications: () => ({
    items: mocks.items,
    unreadCount: mocks.items.filter(item => !item.read).length,
    actionCount: mocks.items.filter(item => item.action_required).length,
    loading: false,
    error: "",
    realtimeStatus: "unavailable",
    markRead: mocks.markRead,
    targetFor: mocks.targetFor,
  }),
}));

const item = (overrides: Partial<NotificationViewModel> = {}): NotificationViewModel => ({
  public_id: "notification-1",
  notification_type: "INCIDENT_CREATED",
  severity: "INFO",
  title: "계정 보안 안내",
  body: "새 로그인 알림을 확인해 주세요.",
  resource: { resource_type: "INCIDENT", resource_public_id: "incident-1", resource_label: "INC-1" },
  resource_label: "INC-1",
  target_path: "/control",
  delivery_status: "DELIVERED",
  read: false,
  delivered_at: "2026-07-22T01:00:00Z",
  read_at: null,
  created_at: "2026-07-22T01:00:00Z",
  action_required: true,
  action_label: "사건 보기",
  reason: "INCIDENT_UNACKNOWLEDGED",
  state_label: "조치 필요",
  ...overrides,
});

function openPopover() {
  render(<NotificationPopover />);
  fireEvent.click(screen.getByRole("button", { name: /알림/ }));
  return screen.getByRole("dialog", { name: mocks.role === "GENERAL_USER" ? "알림" : "업무 알림" });
}

beforeEach(() => {
  mocks.role = "GENERAL_USER";
  mocks.items = [];
  mocks.markRead.mockClear();
  mocks.push.mockClear();
  mocks.targetFor.mockReset().mockReturnValue(null);
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false })) });
  window.requestAnimationFrame = callback => { callback(0); return 0; };
});

afterEach(cleanup);

describe("NotificationPopover", () => {
  it("shows the general-user empty state without operations tabs or dangling tabpanel ARIA", () => {
    const dialog = openPopover();

    expect(within(dialog).getByText("새로운 알림이 없습니다")).toBeInTheDocument();
    expect(within(dialog).queryByRole("tab", { name: /처리 필요/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("tab", { name: /최근 업데이트/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("tabpanel")).not.toBeInTheDocument();
    expect(dialog.querySelector("[aria-labelledby^='notification-popover-tab-']")).toBeNull();
  });

  it("shows injected general-user notifications newest-first without operations UI", async () => {
    mocks.items = [
      item({ public_id: "older", title: "이전 서비스 안내", created_at: "2026-07-21T01:00:00Z" }),
      item({ public_id: "newer", title: "최신 계정 안내", created_at: "2026-07-22T01:00:00Z" }),
    ];
    const dialog = openPopover();
    const rows = within(dialog).getAllByRole("button", { name: /읽지 않음/ });

    expect(rows.map(row => row.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("최신 계정 안내"), expect.stringContaining("이전 서비스 안내")]));
    expect(rows[0]).toHaveTextContent("최신 계정 안내");
    expect(within(dialog).queryByText("사건 보기")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("조치 필요")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("INC-1")).not.toBeInTheDocument();

    fireEvent.click(rows[0]);
    await waitFor(() => expect(mocks.markRead).toHaveBeenCalledWith("newer"));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("keeps operations tabs and actionable notification UI for controllers", () => {
    mocks.role = "CONTROLLER";
    mocks.items = [item()];
    const dialog = openPopover();

    expect(within(dialog).getByRole("tab", { name: /처리 필요/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: /최근 업데이트/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "notification-popover-tab-action");
    expect(within(dialog).getByRole("button", { name: /사건 보기/ })).toBeInTheDocument();
  });
});
