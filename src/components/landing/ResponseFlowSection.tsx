"use client";
import { useState } from "react";
import { DetectionOverlay, type NormalizedBBox } from "./DetectionOverlay";

const steps = [
 {number:"01",title:"AI 실시간 탐지",shortDescription:"CCTV 기반 위험 객체 분류",description:"CCTV 영상에서 낙하물, 야생동물, 이륜차 위험을 실시간으로 분류합니다.",tags:["실시간 분석","AI 탐지","위험 객체 분류"],kind:"detection",input:"CCTV 실시간 영상",process:"위험 객체 탐지 및 유형 분류",result:"탐지 이미지와 신뢰도 생성"},
 {number:"02",title:"사건 생성",shortDescription:"탐지 결과 자동 사건화",description:"탐지 위치와 위험 점수, 근거 영상을 하나의 사건으로 자동 구성합니다.",tags:["사건 자동 생성","위치 정보","위험도 기록"],kind:"incident",input:"AI 탐지 결과 수집",process:"사건 번호·위험도·위치 생성",result:"사건 상태 CREATED"},
 {number:"03",title:"관제 판단",shortDescription:"실제 위험 여부 확인",description:"관제 관리자가 AI 근거를 확인하고 실제 위험 여부를 빠르게 판단합니다.",tags:["근거 영상","위험 판정","관제 확인"],kind:"control",input:"탐지 이미지·객체 유형·위험 점수",process:"사건 선점·근거 검토·위험 판정",result:"위험 판정과 다음 대응 상태 기록"},
 {number:"04",title:"출동 연결",shortDescription:"현장 담당자 배정",description:"사건 위치와 도로 상황을 바탕으로 가장 가까운 현장 대응 인력에 연결합니다.",tags:["담당자 배정","위치 전달","출동 요청"],kind:"dispatch",input:"확정 사건·위치·도로 상황",process:"출동 담당자 선택 및 요청",result:"수락·거절 또는 재배정 상태"},
 {number:"05",title:"현장 대응",shortDescription:"조치 결과 실시간 반영",description:"현장 조치 과정과 완료 결과를 관제 화면에 실시간으로 동기화합니다.",tags:["현장 도착","조치 결과","실시간 동기화"],kind:"field",input:"출동 요청·사건 위치",process:"출발·이동·도착·조치 시작",result:"전후 사진·결과 등록 및 관제 확인"},
] as const;
const ChevronIcon=({direction}:{direction:"left"|"right"})=><svg viewBox="0 0 24 24" aria-hidden="true"><path d={direction==="left"?"m15 18-6-6 6-6":"m9 18 6-6-6-6"}/></svg>;
type DetectionOverlayData = {
 id:string;
 type:"normal"|"danger";
 label:string;
 confidence:number;
 bbox:NormalizedBBox;
 labelPosition:"top-left"|"top-right";
};
const detectionOverlays:DetectionOverlayData[]=[
 {id:"vehicle",type:"normal",label:"vehicle",confidence:96,bbox:{x:.493,y:.405,width:.09,height:.105},labelPosition:"top-left"},
 {id:"motorcycle",type:"danger",label:"motorcycle",confidence:92,bbox:{x:.697,y:.39,width:.035,height:.105},labelPosition:"top-left"},
];
function DetailIcon({type}:{type:"input"|"process"|"result"}){
 if(type==="input")return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-2v8l-4-2z"/></svg>;
 if(type==="process")return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3"/></svg>;
 return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6m-11 6 2 2 4-4"/></svg>;
}
function RoadbogoLocationMarker(){
 return <div className="brand-map-marker" aria-hidden="true"><span className="brand-map-marker__pulse brand-map-marker__pulse--one"/><span className="brand-map-marker__pulse brand-map-marker__pulse--two"/><svg className="brand-map-marker__pin" viewBox="0 0 30 40" aria-hidden="true"><defs><linearGradient id="roadbogo-marker-gradient" x1="3" y1="3" x2="27" y2="38" gradientUnits="userSpaceOnUse"><stop stopColor="#3C6FE8"/><stop offset="1" stopColor="#26999E"/></linearGradient></defs><path fill="url(#roadbogo-marker-gradient)" d="M15 1C7.3 1 1.5 7 1.5 14.4 1.5 24.8 15 39 15 39s13.5-14.2 13.5-24.6C28.5 7 22.7 1 15 1Z"/><circle cx="15" cy="14" r="4.5" fill="#FCFCFA"/></svg></div>;
}
function ProductPreview({kind}:{kind:(typeof steps)[number]["kind"]}){
 if(kind==="detection")return <div className="flow-preview flow-preview--camera"><div className="flow-camera__top"><span><i/> CAM 07 · LIVE</span><small>AI VISION ACTIVE</small></div><div className="flow-camera__scene">{detectionOverlays.map(overlay=><DetectionOverlay key={overlay.id} objectType={overlay.id} variant={overlay.type} label={overlay.label} confidence={overlay.confidence} bbox={overlay.bbox} className={`response-detection response-detection--label-${overlay.labelPosition}`} compactLabel/>)}<b>서해안고속도로 · 서울 방향</b></div></div>;
 if(kind==="incident")return <div className="flow-preview flow-preview--incident"><div className="flow-ui-head"><span>NEW INCIDENT</span><b>자동 생성 완료</b></div><strong>INC-2026-0715</strong><div className="flow-data-grid"><span>위험 점수<b>92 · 높음</b></span><span>객체 유형<b>이륜차</b></span><span>탐지 위치<b>서해안선 23.4km</b></span><span>근거 영상<b>CAM 07 연결</b></span></div></div>;
 if(kind==="control")return <div className="flow-preview flow-preview--control"><div className="flow-ui-head"><span>CONTROL REVIEW</span><b>검토 중</b></div><div className="flow-score"><span>AI 신뢰도<strong>92%</strong></span><i><b/></i></div><div className="flow-review-row"><span>객체 추적 안정</span><span>차로 진입 위험</span></div><div className="flow-decision"><button type="button">오탐 처리</button><button type="button">실제 위험 확인</button></div></div>;
 if(kind==="dispatch")return <div className="flow-preview flow-preview--dispatch"><div className="flow-map"><RoadbogoLocationMarker/><span>사건 위치</span><b>강북 2팀 · 4.2km</b><em>예상 7분</em></div><div className="flow-team"><span>추천 대응팀<strong>강북 현장대응 2팀</strong></span><button type="button">출동 연결</button></div></div>;
 return <div className="flow-preview flow-preview--field"><div className="flow-phone"><div><span>현장 조치</span><b>INC-2026-0715</b></div><ol><li className="is-done">현장 도착</li><li className="is-current">조치 진행</li><li>처리 완료</li></ol><div className="flow-upload">＋ 현장 사진 및 결과 등록</div></div><div className="flow-sync"><i/>관제 시스템과 동기화 중</div></div>;
}

export function ResponseFlowSection(){const[active,setActive]=useState(0);const step=steps[active];
 return <>
 <section id="service-flow" className="service-flow" aria-labelledby="service-flow-title" tabIndex={-1}>
  <div className="service-flow__header"><div className="service-flow__intro"><p>RESPONSE FLOW</p><h2 id="service-flow-title">위험 탐지 이후,<br/>도로보GO는 이렇게 대응합니다.</h2><p className="service-flow__description">AI 탐지 결과가 사건으로 전환되고,<br/>관제 판단과 출동·현장 조치로 이어지는 과정을 확인하세요.</p></div></div>
  <div className="response-showcase"><nav className="response-step-nav" aria-label="대응 프로세스 단계">{steps.map((item,index)=><button type="button" key={item.number} className={active===index?"is-active":""} aria-pressed={active===index} onClick={()=>setActive(index)}><span>{item.number}</span><span className="response-step-nav__label"><strong>{item.title}</strong><small>{item.shortDescription}</small></span><i><ChevronIcon direction="right"/></i></button>)}</nav><article className={`response-showcase__panel response-showcase__panel--${step.kind}`} key={step.number}><div className="response-panel__copy"><header><div><p>STEP {step.number}</p><h3>{step.title}</h3></div></header><p>{step.description}</p><dl className="response-step-details"><div><dt><i><DetailIcon type="input"/></i><span>입력</span></dt><dd>{step.input}</dd></div><div><dt><i><DetailIcon type="process"/></i><span>AI 처리</span></dt><dd>{step.process}</dd></div><div><dt><i><DetailIcon type="result"/></i><span>결과</span></dt><dd>{step.result}</dd></div></dl><div className="response-step-tags">{step.tags.map(tag=><span key={tag}>{tag}</span>)}</div></div><ProductPreview kind={step.kind}/></article></div>
 </section>
 </>}
