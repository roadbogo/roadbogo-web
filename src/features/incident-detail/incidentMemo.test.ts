import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardIncident } from "@/features/control-dashboard/dashboardTypes";
import { apiRequest } from "@/lib/apiClient";
import { ApiIncidentDetailAdapter } from "./incidentApiAdapter";
import { resolveMemoAvailability } from "./incidentDetailDomain";

vi.mock("@/lib/apiClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apiClient")>("@/lib/apiClient");
  return { ...actual, apiRequest: vi.fn() };
});

const request = vi.mocked(apiRequest);
const incidentPublicId = "11111111-1111-4111-8111-111111111112";
const incident = {
  public_id: incidentPublicId,
  status: "UNDER_REVIEW",
  assigned_controller: { public_id: "controller-id", display_name: "관제 담당자" },
} as DashboardIncident;

describe("incident memo policy", () => {
  it("allows only the assigned controller with decision permission while reviewing", () => {
    expect(resolveMemoAvailability(incident, { public_id: "controller-id", permissions: ["INCIDENT.DECIDE"] }).allowed).toBe(true);
    expect(resolveMemoAvailability(incident, { public_id: "other", permissions: ["INCIDENT.DECIDE"] }).allowed).toBe(false);
    expect(resolveMemoAvailability(incident, { public_id: "controller-id", permissions: [] }).allowed).toBe(false);
  });

  it.each(["NEW", "ACKNOWLEDGED", "CLAIMED", "FALSE_POSITIVE", "CLOSED"] as const)("disables creation in %s", status => {
    expect(resolveMemoAvailability({ ...incident, status } as DashboardIncident, { public_id: "controller-id", permissions: ["INCIDENT.DECIDE"] }).allowed).toBe(false);
  });
});

describe("incident memo API adapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts trimmed content with only the documented request fields", async () => {
    request.mockResolvedValue({
      public_id: "44444444-4444-4444-8444-444444444444",
      incident_public_id: incidentPublicId,
      memo_type: "REVIEW",
      content: "현장 영상 재확인 필요",
      created_by: { public_id: "controller-id", user_name: "관제 담당자" },
      created_at: "2026-07-22T09:00:00Z",
    });
    const adapter = new ApiIncidentDetailAdapter();
    await expect(adapter.createMemo({ incident_public_id: incidentPublicId, memo_type: "REVIEW", content: "  현장 영상 재확인 필요  ", actor_public_id: "local-only", actor_name: "local-only" })).resolves.toMatchObject({ memo_type: "REVIEW", content: "현장 영상 재확인 필요" });
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith(`/incidents/${incidentPublicId}/memos`, { method: "POST", body: { memo_type: "REVIEW", content: "현장 영상 재확인 필요" } });
  });

  it("rejects empty and oversized content before requesting", async () => {
    const adapter = new ApiIncidentDetailAdapter();
    await expect(adapter.createMemo({ incident_public_id: incidentPublicId, memo_type: "GENERAL", content: "   ", actor_public_id: "me", actor_name: "me" })).rejects.toThrow("INVALID_INCIDENT_MEMO");
    await expect(adapter.createMemo({ incident_public_id: incidentPublicId, memo_type: "GENERAL", content: "a".repeat(2001), actor_public_id: "me", actor_name: "me" })).rejects.toThrow("INVALID_INCIDENT_MEMO");
    expect(request).not.toHaveBeenCalled();
  });
});
