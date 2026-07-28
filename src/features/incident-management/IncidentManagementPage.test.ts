import { describe, expect, it } from "vitest";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import {
  filterAndSortIncidents, formatDateRange, incidentResultRange, isArchiveEligible, kstDateBoundaryToUtc,
  queryFromSearchParams, queryToSearchParams, statusForIncidentTab, visibleIncidentPages,
} from "./incidentManagementDomain";
import { buildIncidentListApiPath, MockIncidentManagementRepository } from "./incidentManagementRepository";
import type { IncidentListQuery, IncidentManagementItem } from "./incidentManagementTypes";

const baseQuery: IncidentListQuery = {
  page: 1, size: 10, keyword: "", status: "ALL", risk: "ALL",
  tab: "active", sort: "priority,desc",
};

function items(): IncidentManagementItem[] {
  return createMockDashboardSnapshot().incidents.map(item => ({
    ...item, first_detected_at: item.created_at, last_detected_at: item.updated_at,
    cctv_name: "CAM", direction_code: "UNKNOWN", road_name: "도로", road_section_name: "구간",
  }));
}

describe("incident management query", () => {
  it("keeps priority as the default and maps server sort values", () => {
    expect(queryFromSearchParams(new URLSearchParams()).sort).toBe("priority,desc");
    expect(queryFromSearchParams(new URLSearchParams("size=50")).size).toBe(10);
    expect(buildIncidentListApiPath(baseQuery)).toContain("page=1&size=10");
    expect(buildIncidentListApiPath({ ...baseQuery, sort: "first_detected_at,desc" })).toContain("sort=first_detected_at%2Cdesc");
    expect(buildIncidentListApiPath({ ...baseQuery, sort: "first_detected_at,asc" })).toContain("sort=first_detected_at%2Casc");
    expect(buildIncidentListApiPath({ ...baseQuery, sort: "last_detected_at,desc" })).toContain("sort=last_detected_at%2Cdesc");
    expect(buildIncidentListApiPath({ ...baseQuery, sort: "risk_score,desc" })).toContain("sort=risk_score%2Cdesc");
  });

  it("converts full KST days to UTC without manual arithmetic", () => {
    expect(kstDateBoundaryToUtc("2026-07-23")).toBe("2026-07-22T15:00:00.000Z");
    expect(kstDateBoundaryToUtc("2026-07-23", true)).toBe("2026-07-23T14:59:59.999Z");
  });

  it("formats the applied KST date range and preserves the all-period label", () => {
    expect(formatDateRange()).toBe("발생 기간 · 전체");
    expect(formatDateRange("2026-07-01", "2026-07-19")).toBe("2026.07.01 ~ 2026.07.19");
  });

  it("round-trips sorting, dates, filters and page through URL params", () => {
    const query = { ...baseQuery, page: 3, tab: "closed" as const, keyword: "박스", sort: "risk_score,desc" as const, from: "2026-07-01T00:00:00.000Z", to: "2026-07-23T00:00:00.000Z" };
    expect(queryFromSearchParams(queryToSearchParams(query))).toEqual(query);
  });

  it("clears incompatible status filters for closed and archived tabs", () => {
    expect(statusForIncidentTab("active", "OPEN")).toBe("OPEN");
    expect(statusForIncidentTab("closed", "OPEN")).toBe("ALL");
    expect(statusForIncidentTab("archived", "DONE")).toBe("ALL");
    expect(queryFromSearchParams(new URLSearchParams("tab=closed&status=OPEN&page=3"))).toMatchObject({
      tab: "closed", status: "ALL", page: 3,
    });
    expect(queryToSearchParams({ ...baseQuery, tab: "closed", status: "OPEN" }).has("status")).toBe(false);
    expect(buildIncidentListApiPath({ ...baseQuery, tab: "closed", status: "OPEN" })).toContain("status=CLOSED%2CFALSE_POSITIVE");
  });

  it.each([
    [4,1,[1,2,3,4]],
    [5,1,[1,2,3,4,5]],
    [6,1,[1,2,3,4,5]],
    [8,4,[2,3,4,5,6]],
    [8,8,[4,5,6,7,8]],
  ])("shows at most five valid pages for %i pages at page %i", (total,current,expected) => {
    expect(visibleIncidentPages(current,total)).toEqual(expected);
  });

  it.each([
    [1,10,38,"1–10 / 총 38건"],
    [4,10,38,"31–38 / 총 38건"],
    [5,10,47,"41–47 / 총 47건"],
    [1,10,0,"0건"],
  ])("formats a server result range", (page,size,total,expected) => {
    expect(incidentResultRange(page,size,total)).toBe(expected);
  });

  it("sorts a copied Mock result and leaves the source unchanged", () => {
    const source = items();
    const before = [...source];
    const sorted = filterAndSortIncidents(source, { ...baseQuery, sort: "first_detected_at,asc" }, new Set());
    expect(source).toEqual(before);
    expect(sorted.map(item => Date.parse(item.first_detected_at))).toEqual([...sorted].map(item => Date.parse(item.first_detected_at)).sort((a, b) => a - b));
  });
});

describe("incident archive capabilities", () => {
  it("uses the same closed-tab meaning in Mock and API repositories", async () => {
    const repository = new MockIncidentManagementRepository();
    const result = await repository.list({ ...baseQuery, tab: "closed", status: "OPEN" });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every(isArchiveEligible)).toBe(true);
  });

  it.each([0,1,9,10,11,38,47,50,51,83])("paginates %i Mock incidents after filtering with a fixed size of ten",async(total)=>{
    const template=items().find(item=>!isArchiveEligible(item))!;
    const fixtures=Array.from({length:total},(_,index)=>({
      ...template,
      public_id:`fixture-${index}`,
      incident_no:`INC-${String(index).padStart(3,"0")}`,
      first_detected_at:new Date(Date.parse(template.first_detected_at)+index*1000).toISOString(),
    }));
    const repository=new MockIncidentManagementRepository(fixtures);
    const first=await repository.list(baseQuery);
    expect(first.items).toHaveLength(Math.min(10,total));
    expect(first.totalElements).toBe(total);
    expect(first.totalPages).toBe(Math.ceil(total/10));
    if(total>10){
      const last=await repository.list({...baseQuery,page:Math.ceil(total/10)});
      expect(last.items).toHaveLength(total%10||10);
    }
  });

  it("allows only CLOSED and FALSE_POSITIVE by default", () => {
    expect(isArchiveEligible({ status: "CLOSED" })).toBe(true);
    expect(isArchiveEligible({ status: "FALSE_POSITIVE" })).toBe(true);
    expect(isArchiveEligible({ status: "ACTION_COMPLETED" })).toBe(false);
    expect(isArchiveEligible({ status: "UNDER_REVIEW" })).toBe(false);
  });

  it("archives and restores in the Mock repository without changing workflow status", async () => {
    const repository = new MockIncidentManagementRepository();
    const closed = await repository.list({ ...baseQuery, tab: "closed" });
    const target = closed.items[0];
    await repository.archive([target.public_id], "정리");
    expect((await repository.list({ ...baseQuery, tab: "closed" })).items.some(item => item.public_id === target.public_id)).toBe(false);
    const archived = await repository.list({ ...baseQuery, tab: "archived" });
    expect(archived.items[0]).toMatchObject({ public_id: target.public_id, status: target.status, archive_reason: "정리" });
    await repository.restore([target.public_id]);
    expect((await repository.list({ ...baseQuery, tab: "closed" })).items.find(item => item.public_id === target.public_id)?.status).toBe(target.status);
  });

  it("rejects archiving an active incident", async () => {
    const repository = new MockIncidentManagementRepository();
    const active = await repository.list(baseQuery);
    await expect(repository.archive([active.items[0].public_id])).rejects.toThrow("종료된 사건만");
  });
});
