import { describe, expect, it } from "vitest";
import type { DashboardIncident } from "@/features/control-dashboard/dashboardTypes";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import { ApiIncidentDetailAdapter } from "./incidentApiAdapter";
import { availableMemoTypes, resolveMemoAvailability } from "./incidentDetailDomain";
import { MockIncidentDetailAdapter } from "./mockIncidentDetailAdapter";
import type { IncidentMemoType } from "./incidentDetailTypes";

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

  it("offers all four contracted memo types in the mock review workflow", () => {
    expect(availableMemoTypes(incident)).toEqual(["GENERAL", "REVIEW", "DISPATCH", "CLOSURE"]);
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
    expect(adapter.supportsMemoMutation).toBe(false);
  });

  it("does not issue a request through the unsupported memo method", async () => {
    const adapter = new ApiIncidentDetailAdapter();
    await expect(adapter.createMemo({ incident_public_id: incident.public_id, memo_type: "GENERAL", content: "메모", actor_public_id: "me", actor_name: "me" })).rejects.toThrow("UNSUPPORTED_INCIDENT_MEMO");
  });
});

describe("incident memo mock adapter", () => {
  it("persists contracted memo types and rejects unknown types", async () => {
    const target=createMockDashboardSnapshot().incidents.find(item=>item.status==="UNDER_REVIEW" && item.assigned_controller);
    expect(target).toBeDefined();
    const adapter=new MockIncidentDetailAdapter();
    const before=await adapter.get(target!.public_id);
    const request={incident_public_id:target!.public_id,memo_type:"REVIEW" as const,content:"최종 회귀 검증 메모",actor_public_id:target!.assigned_controller!.public_id,actor_name:target!.assigned_controller!.display_name};
    const created=await adapter.createMemo(request);
    const refreshed=await adapter.get(target!.public_id);
    expect(refreshed?.memos[0]).toMatchObject({public_id:created.public_id,memo_type:"REVIEW",content:"최종 회귀 검증 메모"});
    expect(refreshed?.memos).toHaveLength((before?.memos.length??0)+1);
    const dispatch=await adapter.createMemo({...request,memo_type:"DISPATCH",content:"출동 전달 메모"});
    expect(dispatch).toMatchObject({memo_type:"DISPATCH",content:"출동 전달 메모"});
    await expect(adapter.createMemo({...request,memo_type:"UNKNOWN" as IncidentMemoType})).rejects.toThrow("INCIDENT_INVALID_MEMO_TYPE");
  });

  it("preserves revisions and logically deletes only the author's memo", async () => {
    const target=createMockDashboardSnapshot().incidents.find(item=>item.status==="UNDER_REVIEW" && item.assigned_controller)!;
    const adapter=new MockIncidentDetailAdapter();
    const actor={actor_public_id:target.assigned_controller!.public_id,actor_name:target.assigned_controller!.display_name};
    const created=await adapter.createMemo({incident_public_id:target.public_id,memo_type:"REVIEW",content:"최초 검토 내용",...actor});
    const revised=await adapter.updateMemo({incident_public_id:target.public_id,memo_public_id:created.public_id,memo_type:"DISPATCH",content:"출동 전달 내용으로 정정",...actor});

    expect(revised).toMatchObject({
      public_id:created.public_id,
      created_at:created.created_at,
      memo_type:"DISPATCH",
      content:"출동 전달 내용으로 정정",
      revisions:[{memo_type:"REVIEW",content:"최초 검토 내용",revised_by:{public_id:actor.actor_public_id}}],
    });
    expect(revised.updated_at).toBeTruthy();

    await expect(adapter.updateMemo({
      incident_public_id:target.public_id,
      memo_public_id:created.public_id,
      memo_type:"GENERAL",
      content:"다른 사용자의 변경",
      actor_public_id:"other-controller",
      actor_name:"다른 관제자",
    })).rejects.toThrow("AUTH_PERMISSION_DENIED");

    const deleted=await adapter.deleteMemo({
      incident_public_id:target.public_id,
      memo_public_id:created.public_id,
      reason:"중복 기록",
      ...actor,
    });
    expect(deleted).toMatchObject({
      public_id:created.public_id,
      delete_reason:"중복 기록",
      deleted_by:{public_id:actor.actor_public_id},
    });
    expect(deleted.deleted_at).toBeTruthy();

    const refreshed=await adapter.get(target.public_id);
    expect(refreshed?.memos.find(memo=>memo.public_id===created.public_id)).toMatchObject({
      deleted_at:deleted.deleted_at,
      delete_reason:"중복 기록",
    });
  });
});
