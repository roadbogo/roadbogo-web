// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import type { NotificationViewModel } from "@/features/notifications/notificationTypes";

const mocks = vi.hoisted(() => ({
  roles: ["GENERAL_USER"] as AuthenticatedUser["roles"],
  items: [] as NotificationViewModel[],
  push: vi.fn(),
  replace: vi.fn(),
  markRead: vi.fn(async () => true),
}));
const searchParams = new URLSearchParams();

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ useSearchParams: () => searchParams, useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock("@/components/landing/LandingHeader", () => ({ LandingHeader: () => <header data-testid="landing-header" /> }));
vi.mock("@/components/auth/AuthContext", () => ({
  useAuth: () => ({ user: { publicId: "user-1", name: "사용자", role: mocks.roles[0] ?? "GENERAL_USER", roles: mocks.roles, email: "user@example.com", apiPermissions: [], uiRoles: [], uiPermissions: [] } }),
}));
vi.mock("@/features/notifications/NotificationContext", () => ({
  useNotifications: () => ({
    items: mocks.items,
    unreadCount: mocks.items.filter(item => !item.read).length,
    actionCount: mocks.items.filter(item => item.action_required).length,
    loading: false,
    error: "",
    realtimeStatus: "unavailable",
    refresh: vi.fn(),
    markRead: mocks.markRead,
    markAllRead: vi.fn(async () => true),
    targetFor: vi.fn(() => null),
  }),
}));

import NotificationsPage from "./page";

const item = (publicId: string, title: string, read: boolean, createdAt = "2026-07-22T01:00:00Z"): NotificationViewModel => ({
  public_id: publicId,
  notification_type: "INCIDENT_STATUS_CHANGED",
  severity: "INFO",
  title,
  body: "서비스 알림 본문",
  resource: { resource_type: "INCIDENT", resource_public_id: "11111111-1111-4111-8111-111111111108", resource_label: "INC-1" },
  resource_label: "INC-1",
  target_path: "/control/incidents/11111111-1111-4111-8111-111111111108",
  delivery_status: "DELIVERED",
  read,
  delivered_at: createdAt,
  read_at: read ? "2026-07-22T02:00:00Z" : null,
  created_at: createdAt,
  action_required: true,
  action_label: "사건 상세 보기",
  reason: "UPDATE_ONLY",
  state_label: "상태 업데이트",
  evidence: { kind: "CCTV", camera: "CAM-01", location: "테스트 교차로", objectLabel: "위험 객체", confidence: 91, imagePath: "/evidence.jpg" },
});

beforeEach(() => {
  mocks.roles = ["GENERAL_USER"];
  mocks.items = [item("read", "읽은 계정 안내", true), item("unread", "읽지 않은 계정 안내", false)];
  mocks.push.mockClear();
  mocks.replace.mockClear();
  mocks.markRead.mockClear();
  searchParams.forEach((_, key) => searchParams.delete(key));
});
afterEach(cleanup);

describe("notifications page audience layout", () => {
  it("renders general notifications as a single-column account inbox", () => {
    render(<NotificationsPage />);

    expect(screen.getByRole("heading", { name: "알림", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("계정과 서비스 관련 안내를 확인할 수 있습니다")).toBeInTheDocument();
    const tabs = screen.getByRole("tablist", { name: "알림 보기" });
    expect(within(tabs).getByRole("tab", { name: /전체 알림/ })).toBeInTheDocument();
    expect(within(tabs).getByRole("tab", { name: /새 알림/ })).toBeInTheDocument();
    expect(screen.getByText("읽은 계정 안내")).toBeInTheDocument();
    expect(screen.getByText("읽지 않은 계정 안내")).toBeInTheDocument();
    expect(screen.getAllByText("서비스 알림 본문")).toHaveLength(2);
    expect(document.querySelector("time[datetime='2026-07-22T01:00:00Z']")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "읽음 · 읽은 계정 안내" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "읽지 않음 · 읽지 않은 계정 안내" })).toBeInTheDocument();
    expect(screen.queryByText("처리할 업무")).not.toBeInTheDocument();
    expect(screen.queryByText("업무 상세")).not.toBeInTheDocument();
    expect(screen.queryByText("INC-1")).not.toBeInTheDocument();
    expect(screen.queryByText("AI 탐지 근거")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("알림 정렬")).not.toBeInTheDocument();

    fireEvent.click(within(tabs).getByRole("tab", { name: /새 알림/ }));
    expect(screen.queryByText("읽은 계정 안내")).not.toBeInTheDocument();
    expect(screen.getByText("읽지 않은 계정 안내")).toBeInTheDocument();
  });

  it("marks a general notification read before applying an allowed target", async () => {
    render(<NotificationsPage />);
    fireEvent.click(screen.getByText("읽지 않은 계정 안내"));
    expect(mocks.markRead).toHaveBeenCalledWith("unread");
  });

  it("shows the briefing only after a controller explicitly selects an alert", () => {
    mocks.roles = ["CONTROLLER"];
    mocks.items = [item("operation", "운영 사건 알림", false)];
    render(<NotificationsPage />);

    expect(screen.getByRole("heading", { name: "업무 알림", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /내 처리 업무/ })).toBeInTheDocument();
    expect(screen.getByLabelText("중요도")).toBeInTheDocument();
    expect(screen.getByLabelText("유형")).toBeInTheDocument();
    const sort = screen.getByLabelText("알림 정렬");
    expect(within(sort).getByRole("option", { name: "최신순" })).toBeInTheDocument();
    expect(within(sort).getByRole("option", { name: "긴급도순" })).toBeInTheDocument();
    expect(within(sort).getByRole("option", { name: "미열람순" })).toBeInTheDocument();
    expect(screen.getByText("알림을 선택해 주세요")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "사건 상태 변경" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("운영 사건 알림"));
    expect(screen.getAllByText("INC-1").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "사건 상태 변경" })).toBeInTheDocument();
    expect(screen.getByText("지금 할 일")).toBeInTheDocument();
    const disclosure=screen.getByRole("button",{name:"상세 정보 보기"});
    expect(disclosure).toHaveAttribute("aria-expanded","false");
    fireEvent.click(disclosure);
    expect(screen.getByRole("button",{name:"상세 정보 접기"})).toHaveAttribute("aria-expanded","true");
    expect(screen.getByText("AI 탐지 근거")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "사건 열기" })).toBeInTheDocument();
  });

  it("renders five alerts per bundle and clears detail without marking read when navigating",()=>{
    mocks.roles=["CONTROLLER"];
    mocks.items=Array.from({length:7},(_,index)=>item(`operation-${index}`,`업무 ${index+1}`,false,new Date(Date.UTC(2026,6,22,7-index)).toISOString()));
    render(<NotificationsPage/>);

    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("총 7건 · 1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"최근 알림"})).toBeDisabled();
    fireEvent.click(screen.getByText("업무 1"));
    expect(screen.getByRole("heading",{name:"사건 상태 변경"})).toBeInTheDocument();
    mocks.markRead.mockClear();
    fireEvent.click(screen.getByRole("button",{name:"이전 알림"}));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("총 7건 · 2 / 2")).toBeInTheDocument();
    expect(screen.getByText("알림을 선택해 주세요")).toBeInTheDocument();
    expect(mocks.markRead).not.toHaveBeenCalled();
    expect(screen.getByRole("button",{name:"이전 알림"})).toBeDisabled();
  });

  it("keeps an older bundle stable and offers a new-alert return notice",async()=>{
    mocks.roles=["CONTROLLER"];
    mocks.items=Array.from({length:7},(_,index)=>item(`stable-${index}`,`기존 업무 ${index+1}`,false,new Date(Date.UTC(2026,6,22,7-index)).toISOString()));
    const {rerender}=render(<NotificationsPage/>);
    fireEvent.click(screen.getByRole("button",{name:"이전 알림"}));
    expect(screen.getByText("기존 업무 6")).toBeInTheDocument();

    mocks.items=[item("new-arrival","실시간 신규 업무",false,"2026-07-22T09:00:00.000Z"),...mocks.items];
    rerender(<NotificationsPage/>);
    await waitFor(()=>expect(screen.getByRole("button",{name:"새 알림 1건이 도착했습니다."})).toBeInTheDocument());
    expect(screen.queryByText("실시간 신규 업무")).not.toBeInTheDocument();
    expect(screen.getByText("기존 업무 6")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"새 알림 1건이 도착했습니다."}));
    expect(screen.getByText("실시간 신규 업무")).toBeInTheDocument();
    expect(mocks.markRead).not.toHaveBeenCalled();
  });

  it("renders a CONTROL_MANAGER management queue without changing the shared page", () => {
    mocks.roles=["CONTROL_MANAGER"];
    const immediate={...item("manager-new","신규 위험 사건",false),notification_type:"INCIDENT_CREATED" as const,severity:"HIGH" as const};
    const action={...item("manager-rejected","출동 요청 거절",false),notification_type:"DISPATCH_REJECTED" as const,severity:"WARNING" as const};
    const complete={...item("manager-complete","현장 조치 완료",true),notification_type:"ACTION_COMPLETED" as const};
    mocks.items=[immediate,action,complete];
    render(<NotificationsPage/>);

    expect(screen.getByRole("heading",{name:"관제센터 알림",level:1})).toBeInTheDocument();
    expect(screen.getByText("센터 전체 사건에서 확인이 필요한 관리 업무와 주요 상태 변경을 확인합니다.")).toBeInTheDocument();
    expect(screen.getByRole("tab",{name:/관리 대기열 3/})).toHaveAttribute("aria-selected","true");
    expect(screen.getByRole("tab",{name:/센터 알림 3/})).toBeInTheDocument();
    expect(screen.getByLabelText("즉시 확인 1건")).toBeInTheDocument();
    expect(screen.getByLabelText("조치 필요 1건")).toBeInTheDocument();
    expect(screen.getByLabelText("완료 확인 1건")).toBeInTheDocument();
    expect(screen.getByText("알림을 선택해 주세요")).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:/담당자 지정|재배정/})).not.toBeInTheDocument();
  });

  it("keeps tab=unread compatible as the manager center inbox filter",()=>{
    mocks.roles=["CONTROL_MANAGER"];
    mocks.items=[item("manager-read","읽은 센터 알림",true),item("manager-unread","읽지 않은 센터 알림",false)];
    searchParams.set("tab","unread");
    render(<NotificationsPage/>);
    expect(screen.getByRole("tab",{name:/센터 알림/})).toHaveAttribute("aria-selected","true");
    expect(screen.getByRole("button",{name:/새 알림 1/})).toHaveAttribute("aria-pressed","true");
    expect(screen.queryByText("읽은 센터 알림")).not.toBeInTheDocument();
    expect(screen.getByText("읽지 않은 센터 알림")).toBeInTheDocument();
  });

  it("keeps a GENERAL_USER and CONTROLLER multi-role account on operations UI", () => {
    mocks.roles = ["GENERAL_USER", "CONTROLLER"];
    render(<NotificationsPage />);
    expect(screen.getByText("알림 목록")).toBeInTheDocument();
    expect(screen.getByText("사건과 출동 관련 업무 알림을 확인합니다.")).toBeInTheDocument();
    expect(screen.getByLabelText("알림 정렬")).toBeInTheDocument();
  });
});
