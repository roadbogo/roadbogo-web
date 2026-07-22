import { describe, expect, it } from "vitest";
import type { IncidentStatus } from "@/features/control-dashboard/dashboardTypes";
import { getIncidentProgressPresentation, progressByStatus, progressStateLabel } from "./incidentProgress";

const expected:Record<IncidentStatus,{states:string[];currentLabel:string}>={
  NEW:{states:["done","done","current","pending","pending","pending"],currentLabel:"관제 확인 대기"},
  ACKNOWLEDGED:{states:["done","done","current","pending","pending","pending"],currentLabel:"내 담당 지정 대기"},
  CLAIMED:{states:["done","done","current","pending","pending","pending"],currentLabel:"검토 시작 대기"},
  UNDER_REVIEW:{states:["done","done","current","pending","pending","pending"],currentLabel:"위험 판정 진행"},
  DISPATCH_REQUESTED:{states:["done","done","done","current","pending","pending"],currentLabel:"출동 배정·응답 대기"},
  DISPATCHED:{states:["done","done","done","current","pending","pending"],currentLabel:"출동 진행"},
  ON_SCENE:{states:["done","done","done","done","current","pending"],currentLabel:"현장 도착"},
  ACTION_IN_PROGRESS:{states:["done","done","done","done","current","pending"],currentLabel:"현장 조치 진행"},
  ACTION_COMPLETED:{states:["done","done","done","done","done","current"],currentLabel:"관제 종료 대기"},
  CLOSED:{states:["done","done","done","done","done","done"],currentLabel:"사건 종료"},
  FALSE_POSITIVE:{states:["done","done","done","skipped","skipped","done"],currentLabel:"오탐 처리 완료"},
};

describe("incident progress presentation",()=>{
  it.each(Object.entries(expected) as [IncidentStatus,(typeof expected)[IncidentStatus]][])("maps %s explicitly",(status,presentation)=>{
    expect(getIncidentProgressPresentation(status)).toEqual(presentation);
    expect(presentation.states).toHaveLength(6);
    expect(presentation.states.filter(state=>state==="current")).toHaveLength(status==="CLOSED"||status==="FALSE_POSITIVE"?0:1);
  });

  it("covers every incident status",()=>{
    expect(Object.keys(progressByStatus).sort()).toEqual(Object.keys(expected).sort());
  });

  it("provides distinct accessible text for every visual state",()=>{
    expect(progressStateLabel).toEqual({done:"완료",current:"현재",pending:"대기",skipped:"해당 없음"});
  });
});
