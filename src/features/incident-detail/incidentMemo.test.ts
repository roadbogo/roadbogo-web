import { describe, expect, it } from "vitest";
import type { DashboardIncident } from "@/features/control-dashboard/dashboardTypes";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import { ApiIncidentDetailAdapter } from "./incidentApiAdapter";
import { availableMemoTypes, resolveMemoAvailability } from "./incidentDetailDomain";
import { MockIncidentDetailAdapter } from "./mockIncidentDetailAdapter";

const incident = {
  public_id: "11111111-1111-4111-8111-111111111112",
  status: "UNDER_REVIEW",
  assigned_controller: { public_id: "controller-id", display_name: "관제 담당자" },
} as DashboardIncident;

describe("incident memo policy", () => {
  it("allows only the assigned controller with decision permission while reviewing", () => {
    expect(resolveMemoAvailability(incident, { public_id: "controller-id", permissions: ["INCIDENT.DECIDE"] }).allowed).toBe(true);
    expect(resolveMemoAvailability(incident, { public_id: "other", permissions: ["INCIDENT.DECIDE"] }).allowed).toBe(false);
    expect(resolveMemoAvailability(incident, { public_id: "controller-id", permissions: [] }).allowed).toBe(false);
  });

  it("offers only memo types that are usable in the mock review workflow", () => {
    expect(availableMemoTypes(incident)).toEqual(["GENERAL", "REVIEW"]);
  });

  it.each(["NEW", "ACKNOWLEDGED", "CLAIMED", "DISPATCHED", "ACTION_COMPLETED", "FALSE_POSITIVE", "CLOSED"] as const)("disables memo creation and types in %s", status => {
    const target={ ...incident, status } as DashboardIncident;
    expect(resolveMemoAvailability(target, { public_id: "controller-id", permissions: ["INCIDENT.DECIDE"] }).allowed).toBe(false);
    expect(availableMemoTypes(target)).toEqual([]);
  });
});

describe("incident memo API adapter", () => {
  it("marks the real API memo contract as unavailable", () => {
    const adapter = new ApiIncidentDetailAdapter();
    expect(adapter.supportsMemoRead).toBe(false);
    expect(adapter.supportsMemoWrite).toBe(false);
  });

  it("does not issue a request through the unsupported memo method", async () => {
    const adapter = new ApiIncidentDetailAdapter();
    await expect(adapter.createMemo({ incident_public_id: incident.public_id, memo_type: "GENERAL", content: "메모", actor_public_id: "me", actor_name: "me" })).rejects.toThrow("UNSUPPORTED_INCIDENT_MEMO");
  });
});

describe("incident memo mock adapter", () => {
  it("persists a supported memo in the mock record and rejects unsupported types", async () => {
    const target=createMockDashboardSnapshot().incidents.find(item=>item.status==="UNDER_REVIEW" && item.assigned_controller);
    expect(target).toBeDefined();
    const adapter=new MockIncidentDetailAdapter();
    const before=await adapter.get(target!.public_id);
    const request={incident_public_id:target!.public_id,memo_type:"REVIEW" as const,content:"최종 회귀 검증 메모",actor_public_id:target!.assigned_controller!.public_id,actor_name:target!.assigned_controller!.display_name};
    const created=await adapter.createMemo(request);
    const refreshed=await adapter.get(target!.public_id);
    expect(refreshed?.memos[0]).toMatchObject({public_id:created.public_id,memo_type:"REVIEW",content:"최종 회귀 검증 메모"});
    expect(refreshed?.memos).toHaveLength((before?.memos.length??0)+1);
    await expect(adapter.createMemo({...request,memo_type:"DISPATCH"})).rejects.toThrow("INCIDENT_INVALID_MEMO_TYPE");
  });
});
