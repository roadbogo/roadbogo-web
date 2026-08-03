// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import type { NotificationViewModel } from "./notificationTypes";

const state = vi.hoisted(() => ({
  roles: ["GENERAL_USER"] as AuthenticatedUser["roles"],
  items: [] as NotificationViewModel[],
  push: vi.fn(),
  markRead: vi.fn(async () => true),
  markAllRead: vi.fn(async () => true),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: state.push }) }));
vi.mock("@/components/auth/AuthContext", () => ({ useAuth: () => ({ user: { publicId: "u", name: "사용자", role: state.roles[0] ?? "GENERAL_USER", roles: state.roles, email: "u@example.com", apiPermissions: [], uiRoles: [], uiPermissions: [] } }) }));
vi.mock("./NotificationContext", () => ({
  useNotifications: () => ({
    items: state.items,
    unreadCount: state.items.filter(item => !item.read).length,
    actionCount: state.items.filter(item => item.action_required).length,
    loading: false,
    error: "",
    realtimeStatus: "unavailable",
    refresh: vi.fn(async () => undefined),
    markRead: state.markRead,
    markAllRead: state.markAllRead,
    targetFor: (item:NotificationViewModel) => item.target_path,
  }),
}));

import { NotificationPopover } from "./NotificationPopover";

const item = (index: number): NotificationViewModel => ({
  public_id: `n${index}`,
  notification_type: "INCIDENT_CREATED",
  severity: "CRITICAL",
  title: `계정 보안 안내 ${index}`,
  body: "새로운 로그인 안내입니다.",
  resource: { resource_type: "INCIDENT", resource_public_id: `r${index}`, resource_label: `INC-00${index}` },
  target_path: null,
  delivery_status: "DELIVERED",
  read: index % 2 === 0,
  delivered_at: `2026-07-22T0${index}:00:00Z`,
  read_at: index % 2 === 0 ? `2026-07-22T0${index}:10:00Z` : null,
  created_at: `2026-07-22T0${index}:00:00Z`,
  action_required: true,
  action_label: "사건 확인",
  reason: "INCIDENT_UNACKNOWLEDGED",
  state_label: "조치 필요",
  resource_label: `INC-00${index}`,
  evidence: null,
});

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia;
  state.roles = ["GENERAL_USER"];
  state.items = Array.from({ length: 7 }, (_, index) => item(index + 1));
});
afterEach(() => { cleanup(); state.push.mockClear(); state.markRead.mockClear(); state.markAllRead.mockClear(); });
const open = () => { render(<NotificationPopover />); fireEvent.click(screen.getByRole("button", { name: /알림/ })); };

describe("NotificationPopover audiences", () => {
  it("renders at most six newest general notifications without operations metadata or dangling tab aria", () => {
    open();

    expect(screen.getByRole("heading", { name: "알림" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "전체 알림 보기" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText(/처리 필요/)).not.toBeInTheDocument();
    expect(screen.queryByText("최근 업데이트")).not.toBeInTheDocument();
    expect(screen.queryByText("데모 알림 표시 중")).not.toBeInTheDocument();
    expect(screen.queryByText("INC-007")).not.toBeInTheDocument();
    expect(screen.getAllByText(/계정 보안 안내/)).toHaveLength(6);
    expect(screen.getByText("계정 보안 안내 7")).toBeInTheDocument();
    expect(screen.queryByText("계정 보안 안내 1")).not.toBeInTheDocument();
    expect(document.querySelector('[aria-labelledby^="notification-popover-tab-"]')).not.toBeInTheDocument();
  });

  it("keeps operations tabs and metadata for controllers", () => {
    state.roles = ["CONTROLLER"];
    state.items = [item(1)];
    open();
    expect(screen.getByRole("tab", { name: /처리 필요/ })).toBeInTheDocument();
    expect(screen.getByText("INC-001 · 확인 필요")).toBeInTheDocument();
    expect(screen.getByText("데모 알림 표시 중")).toBeInTheDocument();
  });

  it("uses the primary role for multi-role accounts", () => {
    state.roles = ["GENERAL_USER", "CONTROLLER"];
    state.items = [item(1)];
    open();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText("INC-001 · 확인 필요")).not.toBeInTheDocument();
  });

  it("uses the same administrator feed and unread count as the shared notification state", () => {
    state.roles = ["SYSTEM_ADMIN"];
    state.items = [
      {...item(1), public_id:"system", notification_type:"SYSTEM_STATUS", admin_category:"SYSTEM", resource:{resource_type:"SYSTEM",resource_public_id:"system",resource_label:"인증 서비스"},resource_label:"인증 서비스",title:"인증 서비스 연결 장애"},
      {...item(2), public_id:"audit", notification_type:"AUDIT_RECORDED", admin_category:"AUDIT", severity:"INFO", resource:{resource_type:"AUDIT",resource_public_id:"audit",resource_label:"감사 기록"},resource_label:"감사 기록",title:"사용자 정보 변경 기록"},
    ];
    open();

    expect(screen.getByRole("heading", { name: "운영 알림" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("우선 확인")).toBeInTheDocument();
    expect(screen.getByText("최근 알림")).toBeInTheDocument();
    expect(screen.getByText("인증 서비스 연결 장애")).toBeInTheDocument();
    expect(screen.getByText("사용자 정보 변경 기록")).toBeInTheDocument();
    expect(screen.getByText("미확인 1건")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "모든 알림 보기" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByRole("button",{name:/긴급 알림, 인증 서비스 연결 장애/})).toBeInTheDocument();
  });

  it("uses the shared mark-all action once from the header", () => {
    state.roles = ["SYSTEM_ADMIN"];
    state.items = [
      {...item(1), public_id:"system", notification_type:"SYSTEM_STATUS", admin_category:"SYSTEM", resource:{resource_type:"SYSTEM",resource_public_id:"system",resource_label:"인증 서비스"},resource_label:"인증 서비스"},
      {...item(2), public_id:"audit", notification_type:"AUDIT_RECORDED", admin_category:"AUDIT", severity:"INFO", resource:{resource_type:"AUDIT",resource_public_id:"audit",resource_label:"감사 기록"},resource_label:"감사 기록"},
    ];
    open();
    fireEvent.click(screen.getByRole("button", { name: "모두 읽음" }));

    expect(state.markAllRead).toHaveBeenCalledTimes(1);
    expect(state.markRead).not.toHaveBeenCalled();
  });

  it("shows one priority alert and at most three recent alerts without popover filters",()=>{
    state.roles=["SYSTEM_ADMIN"];
    state.items=[
      {...item(1),public_id:"system",notification_type:"SYSTEM_STATUS",admin_category:"SYSTEM",resource:{resource_type:"SYSTEM",resource_public_id:"system",resource_label:"인증 서비스"},resource_label:"인증 서비스",title:"인증 서비스 연결 장애"},
      {...item(3),public_id:"account",notification_type:"ACCOUNT_CHANGED",admin_category:"ACCOUNT",severity:"WARNING",resource:{resource_type:"ACCOUNT",resource_public_id:"account",resource_label:"운영 계정"},resource_label:"운영 계정",title:"비활성 계정 로그인 시도"},
      {...item(4),public_id:"audit",notification_type:"AUDIT_RECORDED",admin_category:"AUDIT",severity:"INFO",resource:{resource_type:"AUDIT",resource_public_id:"audit",resource_label:"감사 기록"},resource_label:"감사 기록",title:"감사 기록 생성"},
      {...item(5),public_id:"role",notification_type:"ROLE_CHANGED",admin_category:"ROLE",severity:"WARNING",resource:{resource_type:"ROLE",resource_public_id:"role",resource_label:"역할 정책"},resource_label:"역할 정책",title:"시스템 관리자 권한 변경"},
    ];
    open();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("인증 서비스 연결 장애")).toBeInTheDocument();
    expect(screen.getByText("시스템 관리자 권한 변경")).toBeInTheDocument();
    expect(screen.getByText("비활성 계정 로그인 시도")).toBeInTheDocument();
    expect(screen.getByText("감사 기록 생성")).toBeInTheDocument();
    expect(screen.getAllByRole("button",{name:/알림,/})).toHaveLength(4);
  });

  it("closes and navigates immediately while saving unread state asynchronously",()=>{
    state.roles=["SYSTEM_ADMIN"];
    state.items=[{...item(1),public_id:"system",notification_type:"SYSTEM_STATUS",admin_category:"SYSTEM",resource:{resource_type:"SYSTEM",resource_public_id:"system",resource_label:"인증 서비스"},resource_label:"인증 서비스",title:"인증 서비스 연결 장애"}];
    open();
    fireEvent.click(screen.getByRole("button",{name:/긴급 알림, 인증 서비스 연결 장애/}));
    expect(state.markRead).toHaveBeenCalledWith("system");
    expect(state.push).toHaveBeenCalledWith("/notifications?notification=system");
    expect(screen.queryByRole("dialog",{name:"운영 알림"})).not.toBeInTheDocument();
  });
});
