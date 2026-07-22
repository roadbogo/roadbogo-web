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

 it("explains why the primary work is unavailable instead of rendering a dead button",()=>{
  const html=renderToStaticMarkup(<SelectedIncidentPanel incident={incident} cctv={cctv} dispatch={dispatch} canAct={false} blockedReason="담당 관제자만 판정을 진행할 수 있습니다."/>);
  expect(html).toContain("담당 관제자만 판정을 진행할 수 있습니다.");
  expect(html).not.toContain('class="command-primary"');
  expect(html).toContain("사건 상세 보기");
 });

 it("offers assignment only when a dispatch-requested incident has no active dispatch",()=>{
  const target=snapshot.incidents.find(item=>item.status==="DISPATCH_REQUESTED")!;
  const targetCctv=snapshot.cctvs.find(item=>item.public_id===target.cctv_public_id)!;
  const withoutDispatch=renderToStaticMarkup(<SelectedIncidentPanel incident={target} cctv={targetCctv} dispatch={null} canAct/>);
  expect(withoutDispatch).toContain("출동 담당자 배정");
  expect(withoutDispatch).toContain("출동 담당자</dt><dd>미배정");
  expect(withoutDispatch).toContain(">출동 배정</a>");
  const activeDispatch=snapshot.dispatches.find(item=>item.incident_public_id===target.public_id)!;
  const waiting=renderToStaticMarkup(<SelectedIncidentPanel incident={target} cctv={targetCctv} dispatch={activeDispatch} canAct/>);
  expect(waiting).toContain("출동 담당자 응답 대기");
  expect(waiting).toContain("수락 대기");
  expect(waiting).not.toContain(">출동 배정</a>");
 });

 it("does not offer assignment while the API dispatch state is unknown",()=>{
  const target=snapshot.incidents.find(item=>item.status==="DISPATCH_REQUESTED")!;
  const targetCctv=snapshot.cctvs.find(item=>item.public_id===target.cctv_public_id)!;
  const loading=renderToStaticMarkup(<SelectedIncidentPanel incident={target} cctv={targetCctv} dispatch={null} dispatchLookupStatus="loading" canAct/>);
  expect(loading).toContain("출동 상태 확인 중");
  expect(loading).not.toContain(">출동 배정</a>");
  const failed=renderToStaticMarkup(<SelectedIncidentPanel incident={target} cctv={targetCctv} dispatch={null} dispatchLookupStatus="error" canAct/>);
  expect(failed).toContain("출동 상태 확인 실패");
  expect(failed).not.toContain(">출동 배정</a>");
 });
});
