// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import type { IncidentManagementItem } from "./incidentManagementTypes";
import { IncidentRow } from "./IncidentManagementPage";

function item(status:IncidentManagementItem["status"]):IncidentManagementItem{
  const source=createMockDashboardSnapshot().incidents[0];
  return{...source,status,first_detected_at:source.created_at,last_detected_at:source.updated_at,cctv_name:"CAM 01",direction_code:"ASC",road_name:"중부고속도로",road_section_name:"일죽IC ~ 호법JC"};
}

afterEach(cleanup);

describe("incident management row",()=>{
  it("keeps the unavailable reason inside the fixed checkbox cell as screen-reader-only text",()=>{
    const{container}=render(<IncidentRow item={item("NEW")} archived={false} management selected={false} onToggle={vi.fn()}/>);
    const checkbox=screen.getByRole("checkbox",{name:/선택/});
    const cell=container.querySelector(".incident-checkbox");
    const reason=screen.getByText("진행 중인 사건은 종료 후 보관할 수 있습니다.");
    expect(checkbox).toBeDisabled();
    expect(cell).toContainElement(reason);
    expect(cell).toHaveAttribute("title","사건 종료 후 보관할 수 있습니다");
    expect(reason).toHaveClass("incident-management-sr-only");
    expect(container.querySelector(".incident-management-row")?.children).toHaveLength(9);
    expect(screen.getByText(sourceIncidentNumber())).toBeInTheDocument();
    expect(screen.getByRole("link",{name:"상세 보기"})).toBeInTheDocument();
  });

  it("enables only a terminal incident checkbox",()=>{
    render(<IncidentRow item={item("CLOSED")} archived={false} management selected={false} onToggle={vi.fn()}/>);
    expect(screen.getByRole("checkbox",{name:/선택/})).toBeEnabled();
    expect(screen.queryByText("진행 중인 사건은 종료 후 보관할 수 있습니다.")).not.toBeInTheDocument();
  });
});

function sourceIncidentNumber(){
  return createMockDashboardSnapshot().incidents[0].incident_no;
}
