import { describe, expect, it } from "vitest";
import type { DashboardIncident } from "@/features/control-dashboard/dashboardTypes";
import { availableMemoTypes, buildIncidentTimeline, canCompareEvidence, canMutateIncidentMemo, dedupeEvidences, isIncidentActionSupported, normalizeMemoType, reasonLabel, recommendedMemoType, resolveIncidentWorkspaceMode, resolvePrimaryIncidentAction, sortIncidentHistories, sortIncidentMemos } from "./incidentDetailDomain";
import type { IncidentDetailRecord, IncidentMemo } from "./incidentDetailTypes";

const incident={public_id:"i",incident_no:"INC",cctv_public_id:"c",status:"CLAIMED",object_category:"DEBRIS",class_code:"TIRE",class_name:"타이어",current_risk_score:80,current_risk_grade:"HIGH",representative_confidence:.9,duration_ms:1000,detection_count:2,assigned_controller:{public_id:"me",display_name:"나"},version_no:2,created_at:"2026-01-01T00:00:00Z",updated_at:"2026-01-01T00:00:00Z"} as DashboardIncident;

describe("incident detail domain",()=>{
 it("resolves adaptive workspace modes",()=>{expect(resolveIncidentWorkspaceMode("NEW")).toBe("EVIDENCE_REVIEW");expect(resolveIncidentWorkspaceMode("DISPATCHED")).toBe("FIELD_RESPONSE");expect(resolveIncidentWorkspaceMode("ACTION_COMPLETED")).toBe("CLOSURE_REVIEW");expect(resolveIncidentWorkspaceMode("CLOSED")).toBe("READ_ONLY")});
 it("checks permission, non-negative version and assignee",()=>{expect(resolvePrimaryIncidentAction(incident,{public_id:"me",permissions:["INCIDENT.DECIDE"]})?.key).toBe("review");expect(resolvePrimaryIncidentAction(incident,{public_id:"other",permissions:["INCIDENT.DECIDE"]})).toBeNull();expect(resolvePrimaryIncidentAction({...incident,status:"NEW",assigned_controller:null,version_no:0},{public_id:"me",permissions:["INCIDENT.CLAIM"]})).toMatchObject({key:"acknowledge",label:"사건 확인"})});
 it("shows API decisions only to the assigned controller with permission and keeps close unsupported",()=>{const reviewing={...incident,status:"UNDER_REVIEW"} as DashboardIncident;const decision=resolvePrimaryIncidentAction(reviewing,{public_id:"me",permissions:["INCIDENT.DECIDE"]});expect(decision?.key).toBe("decide");expect(decision&&isIncidentActionSupported("api",decision.key)).toBe(true);expect(resolvePrimaryIncidentAction(reviewing,{public_id:"me",permissions:[]})).toBeNull();expect(resolvePrimaryIncidentAction(reviewing,{public_id:"other",permissions:["INCIDENT.DECIDE"]})).toBeNull();expect(isIncidentActionSupported("api","close")).toBe(false)});
 it("compares only when the same original frame and bbox are available",()=>{expect(canCompareEvidence({original_image_url:"/frame.jpg",bbox:{x:.1,y:.1,width:.2,height:.2}})).toBe(true);expect(canCompareEvidence({original_image_url:null,bbox:{x:.1,y:.1,width:.2,height:.2}})).toBe(false);expect(canCompareEvidence({original_image_url:"/frame.jpg",bbox:null})).toBe(false)});
 it("keeps readable AI reason labels",()=>{expect(reasonLabel.REPEAT_DETECTION).toBe("반복 탐지 기준 통과")});
 it("deduplicates evidence public ids",()=>{expect(dedupeEvidences([{detection_public_id:"a"},{detection_public_id:"a"},{detection_public_id:"b"}])).toHaveLength(2)});
 it("sorts histories without mutating the source",()=>{const source=[{public_id:"b",event_type:"B",label:"두 번째",actor_name:null,occurred_at:"2026-01-02T00:00:00Z",detail:null},{public_id:"c",event_type:"C",label:"세 번째",actor_name:null,occurred_at:"2026-01-01T00:00:00Z",detail:null},{public_id:"a",event_type:"A",label:"첫 번째",actor_name:null,occurred_at:"2026-01-02T00:00:00Z",detail:null}];const before=[...source];expect(sortIncidentHistories(source).map(item=>item.public_id)).toEqual(["c","a","b"]);expect(source).toEqual(before)});
 it("supports all memo types while retaining a safe general fallback",()=>{const reviewing={...incident,status:"UNDER_REVIEW"} as DashboardIncident;expect(availableMemoTypes(reviewing)).toEqual(["GENERAL","REVIEW","DISPATCH","CLOSURE"]);expect(normalizeMemoType("GENERAL")).toBe("GENERAL");expect(normalizeMemoType("UNKNOWN")).toBe("GENERAL")});
 it("sorts memos newest-first without mutating them and keeps invalid dates last",()=>{const memo=(public_id:string,created_at:string,memo_type:IncidentMemo["memo_type"]="GENERAL"):IncidentMemo=>({public_id,incident_public_id:"i",memo_type,content:public_id,created_by:{public_id:"u",user_name:"사용자"},created_at});const source=[memo("old","2026-07-19T05:00:00Z"),memo("invalid","invalid"),memo("new","2026-07-23T05:00:00Z","DISPATCH")];const before=[...source];expect(sortIncidentMemos(source).map(item=>item.public_id)).toEqual(["new","old","invalid"]);expect(source).toEqual(before)});
 it("allows memo mutation only for the active memo author who is the assigned reviewer",()=>{
  const memo={public_id:"memo",incident_public_id:"i",memo_type:"REVIEW",content:"내용",created_by:{public_id:"me",user_name:"나"},created_at:"2026-01-01T00:00:00Z"} as IncidentMemo;
  const reviewing={...incident,status:"UNDER_REVIEW"} as DashboardIncident;
  const allowed={public_id:"me",permissions:["INCIDENT.DECIDE"]};
  expect(canMutateIncidentMemo(reviewing,memo,allowed,true)).toBe(true);
  expect(canMutateIncidentMemo({...reviewing,status:"CLOSED"} as DashboardIncident,memo,allowed,true)).toBe(false);
  expect(canMutateIncidentMemo({...reviewing,status:"FALSE_POSITIVE"} as DashboardIncident,memo,allowed,true)).toBe(false);
  expect(canMutateIncidentMemo({...reviewing,assigned_controller:{public_id:"other",display_name:"다른 담당자"}} as DashboardIncident,memo,allowed,true)).toBe(false);
  expect(canMutateIncidentMemo(reviewing,{...memo,created_by:{public_id:"other",user_name:"다른 작성자"}},allowed,true)).toBe(false);
  expect(canMutateIncidentMemo(reviewing,memo,{public_id:"me",permissions:[]},true)).toBe(false);
  expect(canMutateIncidentMemo(reviewing,{...memo,deleted_at:"2026-01-02T00:00:00Z"},allowed,true)).toBe(false);
  expect(canMutateIncidentMemo(reviewing,memo,allowed,false)).toBe(false);
 });
 it("uses real dispatch history and localizes synthetic dispatch status without treating the responder as actor",()=>{
  const record={histories:[],memos:[],dispatch:{public_id:"dispatch",status:"EN_ROUTE",responder_label:"출동팀",requested_at:"2026-01-01T00:00:00Z",updated_at:"2026-01-01T00:10:00Z"},request_message:"현장 확인"} as unknown as IncidentDetailRecord;
  const synthetic=buildIncidentTimeline(record);
  expect(synthetic.find(item=>item.id.endsWith(":requested"))).toMatchObject({actor:"시스템",detail:"배정 대상: 출동팀 · 현장 확인"});
  expect(synthetic.find(item=>item.id.endsWith(":updated"))?.title).toBe("출동 상태 · 이동 중");
  expect(synthetic.some(item=>item.title.includes("EN_ROUTE"))).toBe(false);
  const withHistory={...record,histories:[{public_id:"history",event_type:"INCIDENT_UPDATED",label:"출동 담당자 배정",actor_name:"관제 담당자",occurred_at:"2026-01-01T00:00:00Z",detail:"배정 대상: 출동팀"}]} as IncidentDetailRecord;
  const timeline=buildIncidentTimeline(withHistory);
  expect(timeline.filter(item=>item.title.includes("출동 담당자 배정")||item.title==="출동 요청 생성")).toHaveLength(1);
  expect(timeline.find(item=>item.title==="출동 담당자 배정")?.actor).toBe("관제 담당자");
 });
 it.each([["UNDER_REVIEW","REVIEW"],["DISPATCH_REQUESTED","DISPATCH"],["DISPATCHED","DISPATCH"],["ON_SCENE","DISPATCH"],["ACTION_IN_PROGRESS","DISPATCH"],["ACTION_COMPLETED","CLOSURE"],["CLOSED","CLOSURE"],["NEW","GENERAL"]] as const)("recommends %s memo type as %s",(status,type)=>expect(recommendedMemoType(status)).toBe(type));
});
