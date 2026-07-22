import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import { SelectedIncidentPanel } from "./SelectedIncidentPanel";
import { CctvFocusModal } from "./CctvFocusModal";

describe("selected incident workflow",()=>{
 const snapshot=createMockDashboardSnapshot();
 const incident=snapshot.incidents[0];
 const cctv=snapshot.cctvs.find(item=>item.public_id===incident.cctv_public_id)!;
 const dispatch=snapshot.dispatches.find(item=>item.incident_public_id===incident.public_id)??null;

 it("uses the incident UUID for the shared detail action and limits identity badges to two",()=>{
  const html=renderToStaticMarkup(<SelectedIncidentPanel incident={incident} cctv={cctv} dispatch={dispatch} canAct/>);
  expect(html).toContain(`/control/incidents/${incident.public_id}`);
  expect(html).toContain("현재 사건");
  expect(html).not.toContain("선택 사건");
  expect(html).not.toContain("사건 상세 보기 →");
  expect((html.match(/selected-incident-panel__identity/g)??[]).length).toBe(1);
  expect((html.match(/<b/g)??[]).length).toBe(2);
  expect(html).toContain("selected-incident-panel__primary");
  expect(html).not.toContain("<strong>사건 확인</strong>");
  expect(html).toContain("사건 처리하기");
  expect(html).not.toContain("사건 상세 보기");
  expect((html.match(new RegExp(`/control/incidents/${incident.public_id}`,"g"))??[])).toHaveLength(1);
 });

 it("keeps the selected linked incident in focus monitoring",()=>{
  const related=snapshot.incidents.filter(item=>item.cctv_public_id===cctv.public_id).slice(0,2);
  const selected=related.at(-1)!;
  const html=renderToStaticMarkup(<CctvFocusModal open cctv={cctv} relatedIncidents={related} selectedIncident={selected} selectedDispatch={null} canAct returnFocus={null} onClose={vi.fn()} onSelectIncident={vi.fn()}/>);
  expect(html).toContain("현재 탐지");
  expect(html).toContain("연결 사건");
  expect(html).toContain("command-linked-incidents__scroll");
  expect(html).toContain("selected-incident-panel__actions");
  expect(html).toContain("발생 시각");
  expect(html).toContain("현재 상태");
  expect(html).toContain("대표 탐지 이미지");
  expect(html).toContain("response-ai-detection-v2.png");
  expect(html).toContain(`aria-selected="true"`);
  expect(html).toContain(`/control/incidents/${selected.public_id}`);
  expect(html).toContain("사건 처리하기");
 });

 it("uses read-only wording for a linked incident that is not the actionable selection",()=>{
  const otherSelection=snapshot.incidents.find(item=>item.cctv_public_id!==cctv.public_id)!;
  const html=renderToStaticMarkup(<CctvFocusModal open cctv={cctv} relatedIncidents={[incident]} selectedIncident={otherSelection} selectedDispatch={null} canAct returnFocus={null} onClose={vi.fn()} onSelectIncident={vi.fn()}/>);
  expect(html).toContain("사건 내용 보기");
  expect(html).not.toContain("사건 처리하기");
  expect(html).toContain("선택한 사건의 최신 업무 상태를 확인해 주세요.");
 });

 it("shows an honest loading state when neither a stream frame nor representative image is available",()=>{
  const loadingCctv={...cctv,video_state:"LOADING" as const};
  const withoutImage={...incident,representative_image_url:null,detection_bbox:null};
  const html=renderToStaticMarkup(<CctvFocusModal open cctv={loadingCctv} relatedIncidents={[withoutImage]} selectedIncident={withoutImage} selectedDispatch={null} canAct={false} returnFocus={null} onClose={vi.fn()} onSelectIncident={vi.fn()}/>);
  expect(html).toContain("영상 연결 중");
  expect(html).toContain("대표 탐지 이미지를 준비하고 있습니다.");
  expect(html).not.toContain("command-focus-modal__overlay");
 });

 it("renders the other five available CCTVs as public-ID based quick switches",()=>{
  const html=renderToStaticMarkup(<CctvFocusModal open cctv={cctv} cctvs={snapshot.cctvs} incidents={snapshot.incidents} relatedIncidents={[incident]} selectedIncident={incident} selectedDispatch={dispatch} canAct returnFocus={null} onClose={vi.fn()} onSelectIncident={vi.fn()} onSelectCctv={vi.fn()}/>);
  expect((html.match(/집중 관제로 전환/g)??[])).toHaveLength(5);
  expect(html).not.toContain(`${cctv.cctv_name} 집중 관제로 전환`);
 });

 it("uses the shared CCTV priority selector for quick-switch incident metadata",()=>{
  const targetCctv=snapshot.cctvs.find(item=>item.public_id!==cctv.public_id)!;
  const lowerPriority={...incident,public_id:"quick-low",incident_no:"INC-QUICK-LOW",cctv_public_id:targetCctv.public_id,status:"UNDER_REVIEW" as const,current_risk_grade:"MEDIUM" as const,class_name:"낮은 우선 객체",representative_image_url:"/images/incidents/quick-low.png"};
  const higherPriority={...incident,public_id:"quick-high",incident_no:"INC-QUICK-HIGH",cctv_public_id:targetCctv.public_id,status:"NEW" as const,current_risk_grade:"CRITICAL" as const,class_name:"우선 객체",representative_image_url:"/images/incidents/quick-high.png"};
  const render=(incidents:typeof snapshot.incidents)=>renderToStaticMarkup(<CctvFocusModal open cctv={cctv} cctvs={[cctv,targetCctv]} incidents={incidents} relatedIncidents={[incident]} selectedIncident={incident} selectedDispatch={dispatch} canAct returnFocus={null} onClose={vi.fn()} onSelectIncident={vi.fn()} onSelectCctv={vi.fn()}/>);
  for(const html of [render([lowerPriority,higherPriority]),render([higherPriority,lowerPriority])]){
   expect(html).toContain("우선 객체");
   expect(html).toContain("긴급");
   expect(html).toContain("quick-high.png");
   expect(html).not.toContain("낮은 우선 객체");
   expect(html).not.toContain("quick-low.png");
  }
 });

 it("keeps navigation wording honest even when direct actions are unavailable",()=>{
  const html=renderToStaticMarkup(<SelectedIncidentPanel incident={incident} cctv={cctv} dispatch={dispatch} canAct={false} blockedReason="담당 관제자만 판정을 진행할 수 있습니다."/>);
  expect(html).toContain("사건 내용 보기");
  expect(html).not.toContain("사건 처리하기");
  expect(html).toContain("담당 관제자만 판정을 진행할 수 있습니다.");
  expect(html).not.toContain("사건 확인</");
  expect(html).not.toContain("사건 상세 보기");
  expect((html.match(new RegExp(`/control/incidents/${incident.public_id}`,"g"))??[])).toHaveLength(1);
 });

 it.each([
  ["NEW","사건 처리하기","사건 내용 보기"],
  ["ACKNOWLEDGED","사건 처리하기","사건 내용 보기"],
  ["CLAIMED","사건 처리하기","사건 내용 보기"],
  ["UNDER_REVIEW","사건 처리하기","사건 내용 보기"],
  ["DISPATCH_REQUESTED","사건 처리하기","진행 내용 보기"],
  ["DISPATCHED","진행 내용 보기","진행 내용 보기"],
  ["ON_SCENE","현장 상태 보기","현장 상태 보기"],
  ["ACTION_IN_PROGRESS","조치 상태 보기","조치 상태 보기"],
  ["ACTION_COMPLETED","사건 기록 보기","사건 기록 보기"],
  ["CLOSED","사건 기록 보기","사건 기록 보기"],
  ["FALSE_POSITIVE","사건 기록 보기","사건 기록 보기"],
 ] as const)("uses honest detail-navigation wording in %s",(status,actionLabel,viewLabel)=>{
  const target={...incident,status};
  const actionable=renderToStaticMarkup(<SelectedIncidentPanel incident={target} cctv={cctv} dispatch={null} canAct/>);
  const readOnly=renderToStaticMarkup(<SelectedIncidentPanel incident={target} cctv={cctv} dispatch={null} canAct={false}/>);
  expect(actionable).toContain(`>${actionLabel}</span>`);
  expect(readOnly).toContain(`>${viewLabel}</span>`);
  for(const html of [actionable,readOnly]){
   expect((html.match(new RegExp(`/control/incidents/${target.public_id}`,"g"))??[])).toHaveLength(1);
   expect(html).not.toContain("사건 상세 보기");
  }
 });

 it("offers assignment only when a dispatch-requested incident has no active dispatch",()=>{
  const target=snapshot.incidents.find(item=>item.status==="DISPATCH_REQUESTED")!;
  const targetCctv=snapshot.cctvs.find(item=>item.public_id===target.cctv_public_id)!;
  const withoutDispatch=renderToStaticMarkup(<SelectedIncidentPanel incident={target} cctv={targetCctv} dispatch={null} canAct/>);
  expect(withoutDispatch).toContain("출동 담당자</dt><dd>미배정");
  expect(withoutDispatch).toContain(">사건 처리하기</span>");
  const activeDispatch=snapshot.dispatches.find(item=>item.incident_public_id===target.public_id)!;
  const waiting=renderToStaticMarkup(<SelectedIncidentPanel incident={target} cctv={targetCctv} dispatch={activeDispatch} canAct/>);
  expect(waiting).toContain("담당자의 응답을 기다리고 있습니다");
  expect(waiting).toContain("수락 대기");
  expect(waiting).toContain(">사건 처리하기</span>");
 });

 it("does not offer assignment while the API dispatch state is unknown",()=>{
  const target=snapshot.incidents.find(item=>item.status==="DISPATCH_REQUESTED")!;
  const targetCctv=snapshot.cctvs.find(item=>item.public_id===target.cctv_public_id)!;
  const loading=renderToStaticMarkup(<SelectedIncidentPanel incident={target} cctv={targetCctv} dispatch={null} dispatchLookupStatus="loading" canAct={false}/>);
  expect(loading).toContain("출동 정보를 확인하고 있습니다");
  expect(loading).toContain(">진행 내용 보기</span>");
  const failed=renderToStaticMarkup(<SelectedIncidentPanel incident={target} cctv={targetCctv} dispatch={null} dispatchLookupStatus="error" canAct={false}/>);
  expect(failed).toContain("최신 출동 정보를 확인하지 못했습니다");
  expect(failed).toContain(">진행 내용 보기</span>");
 });
});
