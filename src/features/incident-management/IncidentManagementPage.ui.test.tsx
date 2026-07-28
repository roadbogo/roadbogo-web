// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IncidentListQuery, IncidentManagementItem } from "./incidentManagementTypes";

const mocks=vi.hoisted(()=>({
  list:vi.fn(),
  archive:vi.fn(),
  restore:vi.fn(),
  closedItems:[] as IncidentManagementItem[],
  archivedItems:[] as IncidentManagementItem[],
}));

vi.mock("next/link",()=>({default:({href,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a href={href}{...props}>{children}</a>}));
vi.mock("@/components/landing/LandingHeader",()=>({LandingHeader:()=>null}));
vi.mock("./incidentManagementRepository",()=>({
  createIncidentManagementRepository:()=>({
    mode:"mock",
    capabilities:{supportsArchivedIncidentList:true,supportsBulkIncidentArchive:true,supportsBulkIncidentRestore:true},
    list:mocks.list,
    archive:mocks.archive,
    restore:mocks.restore,
  }),
}));

import { IncidentManagementPage } from "./IncidentManagementPage";

const incident=(id:string,archived=false):IncidentManagementItem=>({
  public_id:id,
  incident_no:`INC-${id}`,
  cctv_public_id:"cctv-1",
  status:"CLOSED",
  object_category:"VEHICLE",
  class_code:"stopped_vehicle",
  class_name:"정지 차량",
  current_risk_score:80,
  current_risk_grade:"HIGH",
  representative_confidence:94,
  duration_ms:8000,
  detection_count:5,
  representative_image_kind:"ANNOTATED",
  assigned_controller:null,
  claimed_at:null,
  version_no:1,
  created_at:"2026-07-22T01:00:00.000Z",
  updated_at:"2026-07-22T02:00:00.000Z",
  first_detected_at:"2026-07-22T01:00:00.000Z",
  last_detected_at:"2026-07-22T02:00:00.000Z",
  cctv_name:"CAM 01",
  direction_code:"ASC",
  road_name:"중부고속도로",
  road_section_name:"일죽IC",
  ...(archived?{archived_at:"2026-07-22T03:00:00.000Z",archived_by:"관제자"}:{}),
});

beforeEach(()=>{
  window.history.replaceState(null,"","/control/incidents");
  mocks.closedItems=[];
  mocks.archivedItems=[];
  mocks.list.mockReset();
  mocks.list.mockImplementation(async(query:IncidentListQuery)=>{
    const items=query.tab==="closed"?mocks.closedItems:query.tab==="archived"?mocks.archivedItems:[];
    return {
      items,
      page:query.page,
      size:10,
      totalElements:items.length,
      totalPages:items.length?query.page:0,
      counts:{active:0,closed:mocks.closedItems.length,archived:mocks.archivedItems.length},
    };
  });
  mocks.archive.mockReset();
  mocks.archive.mockResolvedValue(undefined);
  mocks.restore.mockReset();
  mocks.restore.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("incident management status filter",()=>{
  it("enables status only for active incidents and normalizes terminal tabs",async()=>{
    render(<IncidentManagementPage/>);
    const status=screen.getByLabelText("처리 상태");
    expect(status).toBeEnabled();
    fireEvent.change(status,{target:{value:"OPEN"}});
    expect(status).toHaveValue("OPEN");

    fireEvent.click(screen.getByRole("button",{name:/종료 사건/}));
    await waitFor(()=>expect(status).toHaveValue("ALL"));
    expect(status).toBeDisabled();
    expect(window.location.search).not.toContain("status=");

    fireEvent.click(screen.getByRole("button",{name:/보관함/}));
    expect(status).toHaveValue("ALL");
    expect(status).toBeDisabled();

    fireEvent.click(screen.getByRole("button",{name:/운영 사건/}));
    expect(status).toBeEnabled();
    fireEvent.change(status,{target:{value:"REVIEW"}});
    expect(status).toHaveValue("REVIEW");
  });

  it("normalizes an incompatible popstate query in both UI and URL",async()=>{
    render(<IncidentManagementPage/>);
    window.history.pushState(null,"","/control/incidents?tab=closed&status=OPEN&page=3");
    window.dispatchEvent(new PopStateEvent("popstate"));

    const status=screen.getByLabelText("처리 상태");
    await waitFor(()=>expect(status).toHaveValue("ALL"));
    expect(status).toBeDisabled();
    await waitFor(()=>expect(window.location.search).not.toContain("status="));
  });
});

describe("incident management bulk lifecycle",()=>{
  it("reloads once on archive, corrects the last page, and clears success on popstate",async()=>{
    mocks.closedItems=[incident("closed-1")];
    mocks.archive.mockImplementationOnce(async(publicIds:string[])=>{
      mocks.closedItems=mocks.closedItems.filter(item=>!publicIds.includes(item.public_id));
    });
    window.history.replaceState(null,"","/control/incidents?tab=closed&page=2");
    render(<IncidentManagementPage/>);
    await screen.findByText("INC-closed-1");
    fireEvent.click(screen.getByRole("button",{name:"목록 관리"}));
    fireEvent.click(screen.getByRole("checkbox",{name:"INC-closed-1 선택"}));
    fireEvent.click(screen.getByRole("button",{name:"1건 보관"}));
    const callsBefore=mocks.list.mock.calls.length;
    fireEvent.click(screen.getByRole("button",{name:"보관함으로 이동"}));

    await waitFor(()=>expect(mocks.archive).toHaveBeenCalledTimes(1));
    await screen.findByText("보관함으로 이동 완료");
    await waitFor(()=>expect(mocks.list).toHaveBeenCalledTimes(callsBefore+1));
    expect(mocks.list.mock.calls.at(-1)?.[0]).toMatchObject({tab:"closed",page:1});
    expect(screen.queryByText("INC-closed-1")).not.toBeInTheDocument();

    window.history.pushState(null,"","/control/incidents?tab=active&page=1");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(()=>expect(screen.getByRole("button",{name:"목록 관리"})).toBeInTheDocument());
    expect(screen.queryByText("보관함으로 이동 완료")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"목록 관리"}));
    expect(screen.queryByText("보관함으로 이동 완료")).not.toBeInTheDocument();
  });

  it("reloads once after one restore mutation",async()=>{
    mocks.archivedItems=[incident("archived-1",true)];
    mocks.restore.mockImplementationOnce(async(publicIds:string[])=>{
      mocks.archivedItems=mocks.archivedItems.filter(item=>!publicIds.includes(item.public_id));
    });
    window.history.replaceState(null,"","/control/incidents?tab=archived");
    render(<IncidentManagementPage/>);
    await screen.findByText("INC-archived-1");
    fireEvent.click(screen.getByRole("button",{name:"목록 관리"}));
    fireEvent.click(screen.getByRole("checkbox",{name:"INC-archived-1 선택"}));
    fireEvent.click(screen.getByRole("button",{name:"1건 복원"}));
    const callsBefore=mocks.list.mock.calls.length;
    fireEvent.click(screen.getByRole("button",{name:"선택 사건 복원"}));

    await waitFor(()=>expect(mocks.restore).toHaveBeenCalledTimes(1));
    await waitFor(()=>expect(mocks.list).toHaveBeenCalledTimes(callsBefore+1));
    expect(mocks.list.mock.calls.at(-1)?.[0]).toMatchObject({tab:"archived",page:1});
    expect(screen.queryByText("INC-archived-1")).not.toBeInTheDocument();
  });

  it("does not reload or change page after an archive mutation fails",async()=>{
    mocks.closedItems=[incident("failed-1")];
    mocks.archive.mockRejectedValueOnce(new Error("보관 실패"));
    window.history.replaceState(null,"","/control/incidents?tab=closed&page=2");
    render(<IncidentManagementPage/>);
    await screen.findByText("INC-failed-1");
    fireEvent.click(screen.getByRole("button",{name:"목록 관리"}));
    fireEvent.click(screen.getByRole("checkbox",{name:"INC-failed-1 선택"}));
    fireEvent.click(screen.getByRole("button",{name:"1건 보관"}));
    const callsBefore=mocks.list.mock.calls.length;
    fireEvent.click(screen.getByRole("button",{name:"보관함으로 이동"}));

    await screen.findByText("보관 실패");
    expect(mocks.archive).toHaveBeenCalledTimes(1);
    expect(mocks.list).toHaveBeenCalledTimes(callsBefore);
    expect(window.location.search).toContain("page=2");
    expect(screen.getByRole("button",{name:"보관함으로 이동"})).toBeEnabled();
  });
});
