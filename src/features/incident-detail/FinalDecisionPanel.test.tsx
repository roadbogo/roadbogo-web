// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardIncident } from "@/features/control-dashboard/dashboardTypes";
import { FinalDecisionPanel, FinalDecisionSummary, composeDecisionReason, finalDecisionOptions } from "./FinalDecisionPanel";
import type { IncidentDetailRecord, IncidentEvidence } from "./incidentDetailTypes";

const incident={public_id:"i",incident_no:"INC",cctv_public_id:"c",status:"UNDER_REVIEW",object_category:"DEBRIS",class_code:"BOX",class_name:"박스",current_risk_score:64.8,current_risk_grade:"MEDIUM",representative_confidence:.84,duration_ms:5100,detection_count:11,assigned_controller:{public_id:"me",display_name:"관제자"},version_no:7,created_at:"2026-07-19T05:00:00Z",updated_at:"2026-07-19T05:10:00Z"} as DashboardIncident;
const evidence={risk:{risk_score:64.8,risk_grade:"MEDIUM",duration_ms:5100,repeat_count:11,track_id:"t",reason_codes:[]}} as unknown as IncidentEvidence;

describe("FinalDecisionPanel",()=>{
  afterEach(cleanup);

  it("shows exactly the three final outcomes and excludes additional review",()=>{
    render(<FinalDecisionPanel incident={incident} evidence={evidence} busy={false} onCancel={vi.fn()} onConfirm={vi.fn()}/>);
    const group=screen.getByRole("group",{name:"최종 판정 결과"});
    expect(within(group).getAllByRole("radio")).toHaveLength(3);
    expect(within(group).getByText("현장 출동 필요")).toBeInTheDocument();
    expect(within(group).getByText("출동 없이 종료")).toBeInTheDocument();
    expect(within(group).getByText("오탐")).toBeInTheDocument();
    expect(within(group).queryByText("추가 검토")).not.toBeInTheDocument();
    expect(Object.keys(finalDecisionOptions)).toEqual(["REAL_RISK","NO_DISPATCH","FALSE_POSITIVE"]);
  });

  it("expands only the selected outcome and preserves inputs per outcome",()=>{
    render(<FinalDecisionPanel incident={incident} evidence={evidence} busy={false} onCancel={vi.fn()} onConfirm={vi.fn()}/>);
    fireEvent.click(screen.getByRole("radio",{name:/현장 출동 필요/}));
    fireEvent.change(screen.getByLabelText("판정 사유 *"),{target:{value:"도로 장애물 확인"}});
    fireEvent.change(screen.getByLabelText("상세 근거 *"),{target:{value:"박스가 차로에 정지"}});
    expect(screen.getAllByText(/검토 중/).length).toBeGreaterThan(0);
    expect(screen.getByText("출동 요청")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio",{name:/오탐/}));
    expect(screen.getAllByLabelText("판정 사유 *")).toHaveLength(1);
    fireEvent.click(screen.getByRole("radio",{name:/현장 출동 필요/}));
    expect(screen.getByLabelText("판정 사유 *")).toHaveValue("도로 장애물 확인");
    expect(screen.getByLabelText("상세 근거 *")).toHaveValue("박스가 차로에 정지");
  });

  it("validates both fields, previews confirmation, and submits the existing API payload",()=>{
    const onConfirm=vi.fn();
    render(<FinalDecisionPanel incident={incident} evidence={evidence} busy={false} onCancel={vi.fn()} onConfirm={onConfirm}/>);
    fireEvent.click(screen.getByRole("radio",{name:/출동 없이 종료/}));
    const execute=screen.getByRole("button",{name:"출동 없이 종료"});
    expect(execute).toBeDisabled();
    fireEvent.change(screen.getByLabelText("판정 사유 *"),{target:{value:"현장 출동 불필요"}});
    fireEvent.change(screen.getByLabelText("상세 근거 *"),{target:{value:"갓길 밖 객체로 확인"}});
    expect(execute).toBeEnabled();
    fireEvent.click(execute);
    const dialog=screen.getByRole("dialog");
    expect(within(dialog).getByText("출동 없이 사건을 종료할까요?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button",{name:"출동 없이 종료"}));
    expect(onConfirm).toHaveBeenCalledWith({
      decision_type:"NO_DISPATCH",
      decision_reason:composeDecisionReason({reason:"현장 출동 불필요",detail:"갓길 밖 객체로 확인"}),
    });
  });

  it("renders completed decisions as read-only information",()=>{
    const record={incident:{...incident,status:"FALSE_POSITIVE"},decision:{result:"FALSE_POSITIVE",reason:"오인식 확인",decided_by:"김관제",decided_at:"2026-07-19T05:20:00Z"}} as IncidentDetailRecord;
    render(<FinalDecisionSummary record={record}/>);
    expect(screen.getByText("최종 판정 완료")).toBeInTheDocument();
    expect(screen.getByRole("heading",{name:"오탐"})).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
