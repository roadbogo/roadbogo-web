// @vitest-environment jsdom
import { cleanup,render } from "@testing-library/react";
import { afterEach,describe,expect,it,vi } from "vitest";
import { CctvCard } from "./ControlDashboard";
import { createMockDashboardSnapshot } from "./mockDashboardAdapter";

afterEach(cleanup);

describe("CCTV card accessibility",()=>{
 it("uses sibling native buttons for CCTV selection and focus monitoring",()=>{
  const snapshot=createMockDashboardSnapshot(),item=snapshot.cctvs[0],linked=snapshot.incidents.find(incident=>incident.cctv_public_id===item.public_id);
  const view=render(<CctvCard item={item} linked={linked} selected onSelect={vi.fn()} onOpenFocus={vi.fn()}/>);
  const article=view.container.querySelector("article")!;
  const buttons=article.querySelectorAll(":scope > button, :scope > .command-focus-control > button");
  expect(buttons).toHaveLength(2);
  expect(view.getByRole("button",{name:new RegExp(`${item.cctv_name}.*현재 선택됨`)}).getAttribute("aria-pressed")).toBe("true");
  expect((view.getByRole("button",{name:`${item.cctv_name} 집중 관제`}) as HTMLButtonElement).disabled).toBe(false);
  expect(article.querySelector("button button")).toBeNull();
 });
 it("disables only the focus-monitoring button when a CCTV has no stream",()=>{
  const item={...createMockDashboardSnapshot().cctvs[0],has_stream:false};
  const view=render(<CctvCard item={item} selected={false} onSelect={vi.fn()} onOpenFocus={vi.fn()}/>);
  expect((view.getByRole("button",{name:new RegExp(`${item.cctv_name}.*선택 안 됨`)}) as HTMLButtonElement).disabled).toBe(false);
  expect((view.getByRole("button",{name:`${item.cctv_name} 집중 관제`}) as HTMLButtonElement).disabled).toBe(true);
 });
});
