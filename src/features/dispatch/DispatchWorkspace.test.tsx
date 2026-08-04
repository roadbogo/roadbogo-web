// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DispatchAdapter, DispatchDetail } from "./dispatchTypes";
import { dispatchProgressAction } from "./dispatchDomain";

const mocks = vi.hoisted(() => ({
  adapter: {} as DispatchAdapter,
  permissions: ["DISPATCH.UPDATE_OWN"],
}));

vi.mock("@/components/auth/AuthContext", () => ({
  useAuth: () => ({ user: { apiPermissions: mocks.permissions } }),
}));
vi.mock("@/components/landing/LandingHeader", () => ({ LandingHeader: () => <header>header</header> }));
vi.mock("./dispatchAdapterFactory", () => ({
  createDispatchAdapter: () => new Proxy({}, { get: (_target, property) => mocks.adapter[property as keyof DispatchAdapter] }),
}));

import { DispatchWorkspace } from "./DispatchWorkspace";

const baseDetail: DispatchDetail = {
  publicId: "dispatch-1",
  attemptNo: 1,
  status: "ACCEPTED",
  requestMessage: "현장 확인",
  requestedAt: "2026-07-21T00:00:00Z",
  acceptedAt: "2026-07-21T00:10:00Z",
  versionNo: 1,
  incident: {
    publicId: "incident-1",
    incidentNo: "INC-1",
    status: "DISPATCHED",
    objectCategory: "DEBRIS",
    riskGrade: "HIGH",
    cctvName: "CAM 01",
    roadName: "중부고속도로",
    roadSectionName: "일죽IC~호법JC",
    latitude: 37.5,
    longitude: 127.1,
  },
  assignedBy: { publicId: "manager-1", name: "관제 담당자" },
  rejectionReason: null,
  departedAt: null,
  enRouteAt: null,
  arrivedAt: null,
  actionStartedAt: null,
  actionCompletedAt: null,
  cancelledAt: null,
  previousDispatchPublicId: null,
  incidentVersionNo: 1,
};

function adapterFor(detail: DispatchDetail): DispatchAdapter {
  return {
    mode: "mock",
    list: vi.fn().mockResolvedValue({ items: [detail], pagination: { page: 1, size: 20, totalElements: 1, totalPages: 1 } }),
    detail: vi.fn().mockResolvedValue(detail),
    accept: vi.fn(),
    reject: vi.fn(),
    depart: vi.fn(),
    markEnRoute: vi.fn(),
    arrive: vi.fn(),
    startAction: vi.fn(),
    getActionReport: vi.fn().mockResolvedValue(null),
    saveActionReport: vi.fn(),
    uploadActionFile: vi.fn(),
    linkActionFile: vi.fn(),
    completeAction: vi.fn(),
  };
}

describe("DispatchWorkspace progress", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.permissions = ["DISPATCH.UPDATE_OWN"];
    mocks.adapter = adapterFor(baseDetail);
  });

  it.each([
    ["ACCEPTED", dispatchProgressAction.depart.label],
    ["DEPARTED", dispatchProgressAction.markEnRoute.label],
    ["EN_ROUTE", dispatchProgressAction.arrive.label],
    ["ARRIVED", dispatchProgressAction.startAction.label],
  ] as const)("shows only the next action for %s", async (status, label) => {
    mocks.adapter = adapterFor({ ...baseDetail, status });
    render(<DispatchWorkspace initialPublicId={baseDetail.publicId} />);
    expect((await screen.findByRole("button", { name: label })).hasAttribute("disabled")).toBe(false);
    expect(screen.getByLabelText("출동 진행 단계").querySelector('[aria-current="step"]')).toBeTruthy();
  });

  it("confirms a transition and returns focus when the dialog is cancelled", async () => {
    render(<DispatchWorkspace />);
    const trigger = await screen.findByRole("button", { name: dispatchProgressAction.depart.label });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: dispatchProgressAction.depart.confirmTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("executes the confirmed next action once and renders the server result", async () => {
    const progressed = { ...baseDetail, status: "DEPARTED" as const, versionNo: 2, departedAt: "2026-07-21T00:20:00Z" };
    vi.mocked(mocks.adapter.depart).mockResolvedValue({ ok: true, detail: progressed });
    render(<DispatchWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: dispatchProgressAction.depart.label }));
    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: dispatchProgressAction.depart.label });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.adapter.depart).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("출발 상태를 등록했습니다.")).toBeTruthy();
  });

  it("stops at action-in-progress and explains a missing permission", async () => {
    mocks.adapter = adapterFor({ ...baseDetail, status: "ACTION_IN_PROGRESS" });
    const view = render(<DispatchWorkspace />);
    expect(await screen.findByText("현장 조치가 진행 중입니다.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /완료|사진|결과/ })).toBeNull();
    view.unmount();

    mocks.permissions = [];
    mocks.adapter = adapterFor(baseDetail);
    render(<DispatchWorkspace />);
    expect((await screen.findByRole("button", { name: dispatchProgressAction.depart.label }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("현재 계정에는 본인 출동 상태 변경 권한이 없습니다.")).toBeTruthy();
  });
});
