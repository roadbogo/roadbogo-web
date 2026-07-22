import { describe, expect, it } from "vitest";
import { getIncidentRefreshChanges, resolveEvidenceSelection } from "./incidentRefresh";
import type { IncidentDetailRecord } from "./incidentDetailTypes";

const record = {
  incident: { version_no:1,status:"ACKNOWLEDGED",assigned_controller:null,current_risk_score:71,current_risk_grade:"HIGH",updated_at:"2026-07-19T05:10:03Z",detection_count:8 },
  dispatch:null,
  evidences:[{detection_public_id:"representative",is_representative:true},{detection_public_id:"selected",is_representative:false}],
} as unknown as IncidentDetailRecord;

describe("incident refresh state", () => {
  it("distinguishes unchanged and changed records", () => {
    expect(getIncidentRefreshChanges(record, record)).toEqual([]);
    const next={...record,incident:{...record.incident,version_no:2,status:"CLAIMED",detection_count:9},evidences:[...record.evidences,{detection_public_id:"new",is_representative:false}]} as IncidentDetailRecord;
    expect(getIncidentRefreshChanges(record,next)).toEqual(expect.arrayContaining(["version","status","detectionCount","evidenceCount"]));
  });

  it("keeps a valid selection and falls back only when it disappeared", () => {
    expect(resolveEvidenceSelection("selected",record)).toBe("selected");
    expect(resolveEvidenceSelection("removed",record)).toBe("representative");
  });
});
