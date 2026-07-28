// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import { createMockIncidentDetailRecord } from "./mockIncidentDetailAdapter";
import { buildIncidentTimeline } from "./incidentDetailDomain";
import { AssignmentSuccessNotice, DetailTabs, RiskCandidateSummary, TimelineDetail } from "./IncidentCommandWorkspace";
import type { AuthenticatedUser } from "@/components/auth/AuthContext";

function recordFixture() {
  const publicId = createMockDashboardSnapshot().incidents[0].public_id;
  const record = createMockIncidentDetailRecord(publicId);
  if (!record) throw new Error("사건 상세 fixture를 찾을 수 없습니다.");
  return record;
}

afterEach(cleanup);

it("renders a compact dismissible assignment success status",()=>{
  const onClose=vi.fn();
  render(<AssignmentSuccessNotice onClose={onClose}/>);
  expect(screen.getByRole("status")).toHaveTextContent("내 담당 사건으로 지정되었습니다.");
  expect(screen.getByText("이제 사건 검토를 시작할 수 있습니다.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"담당 지정 성공 안내 닫기"}));
  expect(onClose).toHaveBeenCalledOnce();
});

describe("선택 근거 분석", () => {
  it("removes the old text toggle and exposes a count-based mobile disclosure", () => {
    const evidence = recordFixture().evidences[0];
    render(<RiskCandidateSummary evidence={evidence} />);

    expect(screen.queryByText(/분석 근거 (펼치기|접기)/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "판단 근거 4건" })).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "판단 근거 펼치기" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "selected-evidence-reasons");
    expect(document.querySelectorAll("#selected-evidence-reasons article")).toHaveLength(4);
    expect(screen.getByText("TRACK-120", { selector: "#selected-evidence-reasons b" })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "판단 근거 접기" })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows the empty reason label without changing analysis values", () => {
    const evidence = structuredClone(recordFixture().evidences[0]);
    evidence.risk.reason_codes = [];
    render(<RiskCandidateSummary evidence={evidence} />);

    expect(screen.getByText("판단 근거 없음", { selector: "h4" })).toBeInTheDocument();
    expect(screen.getByText("제공된 상세 분석 근거가 없습니다.")).toBeInTheDocument();
    expect(screen.getByText(`${evidence.risk.risk_score}`, { selector: "dd" })).toBeInTheDocument();
  });
});

describe("사건 기록 탭", () => {
  const renderTabs = () => {
    const record = recordFixture();
    const result = render(<DetailTabs record={record} user={null} currentTask={<p>현재 업무 내용</p>} onMemoChanged={vi.fn()} onRefresh={vi.fn().mockResolvedValue(true)} onNotify={vi.fn()} />);
    return { record, ...result };
  };

  it("starts on the integrated current-task panel", () => {
    const { container } = renderTabs();
    const task = screen.getByRole("tab", { name: "업무 진행" });
    expect(screen.getByRole("heading", { name: "사건 업무" })).toBeInTheDocument();
    expect(task).toHaveAttribute("aria-selected", "true");
    expect(task).toHaveAttribute("aria-controls", "incident-workspace-panel-task");
    expect(container.querySelector("#incident-workspace-panel-task")).toHaveAttribute("aria-labelledby", "incident-workspace-tab-task");
    expect(screen.getByText("현재 업무 내용")).toBeInTheDocument();
    expect(screen.getByRole("heading",{name:"업무 진행"})).toBeInTheDocument();
    expect(screen.getByLabelText(/1\. 사건 확인 · 현재/)).toHaveAttribute("aria-current","step");
    expect(screen.queryByText("CURRENT TASK")).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByRole("tab", { name: /관제 메모/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /처리 이력|출동 정보|사건 정보/ })).not.toBeInTheDocument();
  });

  it("combines available records in a newest-first timeline", () => {
    const { record } = renderTabs();
    fireEvent.click(screen.getByRole("tab", { name: /전체 기록/ }));
    expect(screen.getByText("최신순")).toBeInTheDocument();
    const times=buildIncidentTimeline(record).map(item=>Date.parse(item.occurredAt));
    expect(times).toEqual([...times].sort((a,b)=>b-a));
    expect(screen.queryByText("연결된 출동 정보가 없습니다.")).not.toBeInTheDocument();
    expect(screen.getAllByText(/사건|메모|출동/).length).toBeGreaterThan(0);
    expect(record.histories.length).toBeGreaterThan(0);
  });

  it("expands and collapses only a long memo detail accessibly",()=>{
    const detail="긴 메모 내용 ".repeat(20);
    render(<TimelineDetail id="long-memo" type="메모" detail={detail}/>);
    const button=screen.getByRole("button",{name:"더 보기"});
    expect(button).toHaveAttribute("aria-expanded","false");
    expect(button).toHaveAttribute("aria-controls","long-memo-detail");
    fireEvent.click(button);
    expect(screen.getByRole("button",{name:"접기"})).toHaveAttribute("aria-expanded","true");
  });

  it("moves between workspace tabs with arrow keys", () => {
    renderTabs();
    const task = screen.getByRole("tab", { name: "업무 진행" });
    fireEvent.keyDown(task, { key: "ArrowRight" });
    const history = screen.getByRole("tab", { name: /전체 기록/ });
    expect(history).toHaveAttribute("aria-selected", "true");
    expect(history).toHaveFocus();
    fireEvent.keyDown(history, { key: "ArrowLeft" });
    expect(task).toHaveAttribute("aria-selected", "true");
    expect(task).toHaveFocus();
  });

  it("closes a completed stage record from the header without changing incident state", () => {
    const record = recordFixture();
    record.incident.status = "UNDER_REVIEW";
    const onRefresh = vi.fn().mockResolvedValue(true);
    render(<DetailTabs record={record} user={null} currentTask={<p>현재 업무 내용</p>} onMemoChanged={vi.fn()} onRefresh={onRefresh} onNotify={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /1\. 사건 확인 · 완료 · 완료 기록 보기/ }));
    expect(screen.getByRole("heading", { name: "사건 확인 완료" })).toBeInTheDocument();
    expect(screen.queryByText("현재 업무 내용")).not.toBeInTheDocument();
    expect(screen.queryByText("현재 업무로 돌아가기")).not.toBeInTheDocument();
    const closeButton=screen.getByRole("button", { name: "완료 기록 상세 닫기" });
    expect(closeButton).toHaveTextContent("기록 닫기");
    expect(closeButton.querySelector("svg")).toHaveAttribute("aria-hidden","true");
    expect(onRefresh).not.toHaveBeenCalled();
    fireEvent.click(closeButton);
    expect(screen.getByText("현재 업무 내용")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "업무 진행" })).toHaveFocus();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("closes an open completed record with Escape and ignores Escape when no record is open", () => {
    const record = recordFixture();
    record.incident.status = "UNDER_REVIEW";
    const onRefresh = vi.fn().mockResolvedValue(true);
    render(<DetailTabs record={record} user={null} currentTask={<p>현재 업무 내용</p>} onMemoChanged={vi.fn()} onRefresh={onRefresh} onNotify={vi.fn()} />);

    fireEvent.keyDown(window,{key:"Escape"});
    expect(screen.getByText("현재 업무 내용")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /1\. 사건 확인 · 완료 · 완료 기록 보기/ }));
    fireEvent.keyDown(window,{key:"Escape"});
    expect(screen.queryByRole("heading", { name: "사건 확인 완료" })).not.toBeInTheDocument();
    expect(screen.getByText("현재 업무 내용")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "업무 진행" })).toHaveFocus();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("closes a selected record when the task tab is selected again", () => {
    const record = recordFixture();
    record.incident.status = "UNDER_REVIEW";
    render(<DetailTabs record={record} user={null} currentTask={<p>현재 업무 내용</p>} onMemoChanged={vi.fn()} onRefresh={vi.fn().mockResolvedValue(true)} onNotify={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /1\. 사건 확인 · 완료 · 완료 기록 보기/ }));
    fireEvent.click(screen.getByRole("tab", { name: "업무 진행" }));
    expect(screen.queryByRole("heading", { name: "사건 확인 완료" })).not.toBeInTheDocument();
    expect(screen.getByText("현재 업무 내용")).toBeInTheDocument();
  });

  it("offers a review memo only to the assigned reviewer and opens the existing composer with REVIEW selected", () => {
    sessionStorage.clear();
    const record = recordFixture();
    record.incident.status = "UNDER_REVIEW";
    record.incident.assigned_controller = { public_id: "me", display_name: "김관제" };
    const user = { publicId: "me", name: "김관제", apiPermissions: ["INCIDENT.DECIDE"] } as AuthenticatedUser;
    render(<DetailTabs record={record} user={user} currentTask={<p>위험 여부 판정</p>} onMemoChanged={vi.fn()} onRefresh={vi.fn().mockResolvedValue(true)} onNotify={vi.fn()} memoCapabilities={{write:true,mutation:true}} />);
    fireEvent.click(screen.getByRole("button", { name: "판단 근거 메모" }));
    expect(screen.getByRole("dialog", { name: "관제 메모 작성" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "검토 기록" })).toHaveAttribute("aria-checked", "true");
  });
});
