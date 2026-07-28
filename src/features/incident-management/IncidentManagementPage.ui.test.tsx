// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({
  list:vi.fn(async()=>({
    items:[],
    page:1,
    size:10,
    totalElements:0,
    totalPages:0,
    counts:{active:0,closed:0,archived:0},
  })),
}));

vi.mock("next/link",()=>({default:({href,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a href={href}{...props}>{children}</a>}));
vi.mock("@/components/landing/LandingHeader",()=>({LandingHeader:()=>null}));
vi.mock("./incidentManagementRepository",()=>({
  createIncidentManagementRepository:()=>({
    mode:"mock",
    capabilities:{supportsArchivedIncidentList:true,supportsBulkIncidentArchive:true,supportsBulkIncidentRestore:true},
    list:mocks.list,
    archive:vi.fn(),
    restore:vi.fn(),
  }),
}));

import { IncidentManagementPage } from "./IncidentManagementPage";

beforeEach(()=>{
  window.history.replaceState(null,"","/control/incidents");
  mocks.list.mockClear();
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
