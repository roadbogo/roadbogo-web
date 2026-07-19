"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent } from "react";
import { DetectionOverlay } from "./DetectionOverlay";

const steps = [
 {number:"01",title:"위험 후보 식별",shortDescription:"CCTV 기반 위험 객체 식별",question:"무엇이 포착됐는가",description:"CCTV 영상에서 도로 위 위험 후보를 식별하고 객체 유형과 신뢰도를 확인합니다.",tags:["탐지 객체","AI 신뢰도","탐지 시각"],kind:"detection",input:"CCTV 실시간 영상·탐지 위치",process:"위험 객체 식별·유형 분류·신뢰도 산출",result:"이륜차 후보 식별 · 신뢰도 92%",duration:4500},
 {number:"02",title:"사건 자동 생성",shortDescription:"탐지 결과를 사건으로 전환",question:"어떤 사건으로 등록됐는가",description:"탐지 위치와 위험 점수, 근거 영상을 하나의 사건 기록으로 자동 전환합니다.",tags:["사건 번호","위험 등급","사건 상태"],kind:"incident",input:"AI 탐지 결과·근거 영상",process:"사건 번호·위험도·위치 자동 등록",result:"INC-2026-0715 · CREATED",duration:4500},
 {number:"03",title:"관제 검토·판정",shortDescription:"실제 위험 여부와 대응 필요성 확인",question:"실제 대응이 필요한 위험인가",description:"관제 담당자가 탐지 근거와 차로 위험을 검토해 실제 대응 필요성을 판정합니다.",tags:["탐지 신뢰도","차로 위험","관제 판정"],kind:"control",input:"탐지 이미지·추적 상태·위험 점수",process:"근거 검토·차로 위험 확인·최종 판정",result:"실제 위험 확인 · 대응 필요",duration:5500},
 {number:"04",title:"출동 배정",shortDescription:"현장 담당자에게 사건 전달",question:"누가 현장에 대응하는가",description:"관제 담당자가 출동 가능 여부와 담당 구역을 확인해 현장 대응 담당자를 선택하고 사건을 전달합니다.",tags:["담당 구역","출동 가능","요청 상태"],kind:"dispatch",input:"확정 사건·담당자 업무 상태",process:"담당자 선택·사건 전달·출동 요청",result:"강북 현장대응 2팀 · 요청 전달 완료",duration:5500},
 {number:"05",title:"현장 조치 완료",shortDescription:"조치 결과를 실시간으로 반영",question:"사건이 어떻게 마무리됐는가",description:"현장 조치 결과와 전후 사진을 등록하고 완료 상태를 관제 화면에 반영합니다.",tags:["현장 도착","조치 결과","관제 반영"],kind:"field",input:"출동 요청·사건 위치·현장 상태",process:"현장 도착·낙하물 제거·결과 등록",result:"조치 완료 · 관제 실시간 반영",duration:7000},
] as const;
const workflowGroups=[
 {label:"위험 발견·사건화",stepIndexes:[0,1]},
 {label:"관제 의사결정",stepIndexes:[2]},
 {label:"현장 대응",stepIndexes:[3,4]},
] as const;
const FLOW_START_DELAY_MS=900;
const MANUAL_STEP_HOLD_MS=8000;
const ChevronIcon=({direction}:{direction:"left"|"right"})=><svg viewBox="0 0 24 24" aria-hidden="true"><path d={direction==="left"?"m15 18-6-6 6-6":"m9 18 6-6-6-6"}/></svg>;
const CheckIcon=()=> <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>;
type DetectionOverlayData = {
 id:string;
 type:"normal"|"danger";
 label:string;
 confidence:number;
 box:{left:number;top:number;width:number;height:number};
 sourceBox?:{x:number;y:number;width:number;height:number};
 compactLabel?:boolean;
 labelPosition:"top-left"|"top-right";
};
const detectionOverlays:DetectionOverlayData[]=[
 {id:"vehicle",type:"normal",label:"차량",confidence:96,box:{left:46.5,top:40.6,width:10.2,height:10},sourceBox:{x:815,y:382,width:165,height:94},compactLabel:true,labelPosition:"top-left"},
 {id:"motorcycle",type:"danger",label:"오토바이",confidence:92,box:{left:71.8,top:37.7,width:5.6,height:12.5},sourceBox:{x:1155,y:355,width:82,height:118},compactLabel:true,labelPosition:"top-left"},
];

const detectionImageSize={width:1674,height:941};

function getCoverPosition(
 containerWidth:number,
 containerHeight:number,
 sourceBox:NonNullable<DetectionOverlayData["sourceBox"]>,
):CSSProperties{
 const scale=Math.max(containerWidth/detectionImageSize.width,containerHeight/detectionImageSize.height);
 const renderedWidth=detectionImageSize.width*scale;
 const renderedHeight=detectionImageSize.height*scale;
 const cropX=(renderedWidth-containerWidth)/2;
 const cropY=(renderedHeight-containerHeight)/2;

 return {
  left:`${((sourceBox.x*scale-cropX)/containerWidth)*100}%`,
  top:`${((sourceBox.y*scale-cropY)/containerHeight)*100}%`,
  width:`${(sourceBox.width*scale/containerWidth)*100}%`,
  height:`${(sourceBox.height*scale/containerHeight)*100}%`,
 };
}

function DetectionCamera(){
 const sceneRef=useRef<HTMLDivElement>(null);
 const [overlayPositions,setOverlayPositions]=useState<Record<string,CSSProperties>>({});

 useLayoutEffect(()=>{
  const scene=sceneRef.current;
  if(!scene)return;

  const updatePosition=()=>{
   const {width,height}=scene.getBoundingClientRect();
   if(width&&height){
    setOverlayPositions(Object.fromEntries(
     detectionOverlays
      .filter((overlay):overlay is DetectionOverlayData&{sourceBox:NonNullable<DetectionOverlayData["sourceBox"]>}=>Boolean(overlay.sourceBox))
      .map(overlay=>[overlay.id,getCoverPosition(width,height,overlay.sourceBox)]),
    ));
   }
  };

  updatePosition();
  const observer=new ResizeObserver(updatePosition);
  observer.observe(scene);
  return ()=>observer.disconnect();
 },[]);

 return <div className="flow-preview flow-preview--camera"><div className="flow-camera__top"><span><i/> CAM 07 · LIVE</span><small>AI VISION ACTIVE</small></div><div ref={sceneRef} className="flow-camera__scene"><div className="flow-camera__overlays">{detectionOverlays.map(overlay=><DetectionOverlay key={overlay.id} variant={overlay.type} label={overlay.label} confidence={overlay.confidence} compactLabel={overlay.compactLabel} className={`response-detection response-detection--label-${overlay.labelPosition}${overlay.compactLabel?" response-detection--compact":""}`} style={overlayPositions[overlay.id]??{left:`${overlay.box.left}%`,top:`${overlay.box.top}%`,width:`${overlay.box.width}%`,height:`${overlay.box.height}%`}}/>)}</div><b>서해안고속도로 · 서울 방향</b></div></div>;
}
function DetailIcon({type}:{type:"input"|"process"|"result"}){
 if(type==="input")return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-2v8l-4-2z"/></svg>;
 if(type==="process")return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3"/></svg>;
 return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6m-11 6 2 2 4-4"/></svg>;
}
function RoadbogoLocationMarker(){
 return <div className="brand-map-marker" aria-hidden="true"><span className="brand-map-marker__pulse brand-map-marker__pulse--one"/><span className="brand-map-marker__pulse brand-map-marker__pulse--two"/><svg className="brand-map-marker__pin" viewBox="0 0 30 40" aria-hidden="true"><defs><linearGradient id="roadbogo-marker-gradient" x1="3" y1="3" x2="27" y2="38" gradientUnits="userSpaceOnUse"><stop stopColor="#3C6FE8"/><stop offset="1" stopColor="#26999E"/></linearGradient></defs><path fill="url(#roadbogo-marker-gradient)" d="M15 1C7.3 1 1.5 7 1.5 14.4 1.5 24.8 15 39 15 39s13.5-14.2 13.5-24.6C28.5 7 22.7 1 15 1Z"/><circle cx="15" cy="14" r="4.5" fill="#FCFCFA"/></svg></div>;
}
function ProductPreview({kind}:{kind:(typeof steps)[number]["kind"]}){
 if(kind==="detection")return <DetectionCamera/>;
 if(kind==="incident")return <div className="flow-preview flow-preview--incident"><div className="flow-ui-head"><span>사건 INC-2026-0715</span><b>자동 생성 완료</b></div><strong>INC-2026-0715</strong><div className="flow-data-grid"><span>위험 점수<b>92 · 높음</b></span><span>객체 유형<b>이륜차</b></span><span>탐지 위치<b>서해안선 23.4km</b></span><span>근거 영상<b>CAM 07 연결</b></span></div></div>;
 if(kind==="control")return <div className="flow-preview flow-preview--control"><div className="flow-ui-head"><span>사건 INC-2026-0715</span><b>관제 판정</b></div><div className="flow-score"><span>AI 신뢰도<strong>92%</strong></span><i><b/></i></div><div className="flow-review-row"><span>객체 추적 안정</span><span>차로 진입 위험</span></div><div className="flow-judgement-summary"><span>판단 근거<strong>차로 진입 위험 확인</strong></span><span>최종 판정<strong>실제 위험 · 대응 필요</strong></span></div></div>;
 if(kind==="dispatch")return <div className="flow-preview flow-preview--dispatch"><div className="flow-map"><RoadbogoLocationMarker/><span>사건 위치</span><b>강북권 관제 구역</b></div><div className="flow-team"><span>배정 대상<strong>강북 현장대응 2팀</strong><small>담당 구역 · 강북권</small><small>업무 상태 · 출동 가능</small></span><button type="button">출동 연결</button></div></div>;
 return <div className="flow-preview flow-preview--field"><div className="field-operation-panel"><header><div><span>현장 조치</span><strong>INC-2026-0715</strong></div><b>조치 완료</b></header><ol><li className="is-done"><span>현장 도착</span><strong>완료</strong></li><li className="is-done"><span>조치 진행</span><strong>완료</strong></li><li className="is-done"><span>처리 완료</span><strong>완료</strong></li></ol><dl><div><dt>조치 유형</dt><dd>낙하물 제거</dd></div><div><dt>완료 시각</dt><dd>08:28:02</dd></div><div><dt>관제 동기화</dt><dd><i/>실시간 반영 완료</dd></div></dl></div></div>;
}

export function ResponseFlowSection(){
 const[active,setActive]=useState(0);
 const[playback,setPlayback]=useState<"waiting"|"running"|"idle"|"completed">("waiting");
 const[isFlowSelected,setIsFlowSelected]=useState(false);
 const[isInView,setIsInView]=useState(false);
 const[isDocumentVisible,setIsDocumentVisible]=useState(true);
 const[isHovering,setIsHovering]=useState(false);
 const[hasFocusWithin,setHasFocusWithin]=useState(false);
 const[prefersReducedMotion,setPrefersReducedMotion]=useState(false);
 const[timerRevision,setTimerRevision]=useState(0);
 const[timing,setTiming]=useState<{remaining:number;total:number}>({remaining:steps[0].duration,total:steps[0].duration});
 const sectionRef=useRef<HTMLElement>(null);
 const remainingMsRef=useRef<number>(steps[0].duration);
 const totalMsRef=useRef<number>(steps[0].duration);
 const timerStartedAtRef=useRef<number|null>(null);
 const step=steps[active];
 const isTemporarilyPaused=isHovering||hasFocusWithin||!isInView||!isDocumentVisible||!isFlowSelected;
 const isProgressing=playback==="running"&&!isTemporarilyPaused;

 const prepareStep=useCallback((next:number,duration:number)=>{
  timerStartedAtRef.current=null;
  remainingMsRef.current=duration;
  totalMsRef.current=duration;
  setTiming({remaining:duration,total:duration});
  setActive(Math.max(0,Math.min(steps.length-1,next)));
  setPlayback("running");
  setTimerRevision(revision=>revision+1);
 },[]);

 const restartFlow=useCallback((reducedMotion:boolean)=>{
  timerStartedAtRef.current=null;
  remainingMsRef.current=steps[0].duration;
  totalMsRef.current=steps[0].duration;
  setTiming({remaining:steps[0].duration,total:steps[0].duration});
  setActive(0);
  setPlayback(reducedMotion?"idle":"waiting");
  setTimerRevision(revision=>revision+1);
 },[]);

 useEffect(()=>{
  const syncSelection=()=>{
   setIsFlowSelected(document.getElementById("platform-tab-flow")?.getAttribute("aria-selected")==="true");
  };
  const handleSlideChange=(event:Event)=>{
   const detail=(event as CustomEvent<{key?:string}>).detail;
   const selected=detail?.key==="flow";
   setIsFlowSelected(selected);
   if(selected)restartFlow(prefersReducedMotion);
  };
  syncSelection();
  window.addEventListener("roadbogo:platform-slide-change",handleSlideChange);
  return()=>window.removeEventListener("roadbogo:platform-slide-change",handleSlideChange);
 },[prefersReducedMotion,restartFlow]);

 useEffect(()=>{
  const section=sectionRef.current;
  if(!section)return;
  const syncVisibility=()=>{
   const rect=section.getBoundingClientRect();
   const visibleHeight=Math.max(0,Math.min(rect.bottom,window.innerHeight)-Math.max(rect.top,0));
   const requiredHeight=Math.min(rect.height*.25,window.innerHeight*.45);
   setIsInView(visibleHeight>=requiredHeight);
  };
  const observer=new IntersectionObserver(syncVisibility,{threshold:[0,.2,.4]});
  observer.observe(section);
  window.addEventListener("scroll",syncVisibility,{passive:true});
  window.addEventListener("resize",syncVisibility);
  syncVisibility();
  return()=>{
   observer.disconnect();
   window.removeEventListener("scroll",syncVisibility);
   window.removeEventListener("resize",syncVisibility);
  };
 },[]);

 useEffect(()=>{
  const handleVisibility=()=>setIsDocumentVisible(document.visibilityState==="visible");
  handleVisibility();
  document.addEventListener("visibilitychange",handleVisibility);
  return()=>document.removeEventListener("visibilitychange",handleVisibility);
 },[]);

 useEffect(()=>{
  const media=window.matchMedia("(prefers-reduced-motion: reduce)");
  const handleChange=()=>setPrefersReducedMotion(media.matches);
  handleChange();
  media.addEventListener("change",handleChange);
  return()=>media.removeEventListener("change",handleChange);
 },[]);

 useEffect(()=>{
  if(playback!=="waiting"||prefersReducedMotion||!isFlowSelected||!isInView||!isDocumentVisible||isHovering||hasFocusWithin)return;
  const timer=window.setTimeout(()=>{
   prepareStep(0,steps[0].duration);
  },FLOW_START_DELAY_MS);
  return()=>window.clearTimeout(timer);
 },[hasFocusWithin,isDocumentVisible,isFlowSelected,isHovering,isInView,playback,prefersReducedMotion,prepareStep,timerRevision]);

 useEffect(()=>{
  if(!isProgressing)return;
  const scheduledRemaining=remainingMsRef.current;
  timerStartedAtRef.current=performance.now();
  const timer=window.setTimeout(()=>{
   timerStartedAtRef.current=null;
   if(active<steps.length-1){
    prepareStep(active+1,steps[active+1].duration);
   }else{
    remainingMsRef.current=0;
    setTiming(current=>({...current,remaining:0}));
    setPlayback("completed");
   }
  },scheduledRemaining);
  return()=>{
   window.clearTimeout(timer);
   if(timerStartedAtRef.current!==null){
    const elapsed=performance.now()-timerStartedAtRef.current;
    const remaining=Math.max(0,scheduledRemaining-elapsed);
    remainingMsRef.current=remaining;
    setTiming(current=>({...current,remaining}));
    timerStartedAtRef.current=null;
   }
  };
 },[active,isProgressing,prepareStep,timerRevision]);

 const handleFocusCapture=()=>setHasFocusWithin(true);
 const handleBlurCapture=(event:FocusEvent<HTMLElement>)=>{
  if(!event.currentTarget.contains(event.relatedTarget as Node|null))setHasFocusWithin(false);
 };
 const handleManualStep=(index:number)=>{
  timerStartedAtRef.current=null;
  setActive(index);
  if(prefersReducedMotion){
   remainingMsRef.current=0;
   setTiming(current=>({...current,remaining:0}));
   setPlayback(index===steps.length-1?"completed":"idle");
  }else if(index===steps.length-1){
   remainingMsRef.current=0;
   setTiming(current=>({...current,remaining:0}));
   setPlayback("completed");
  }else{
   remainingMsRef.current=MANUAL_STEP_HOLD_MS;
   totalMsRef.current=MANUAL_STEP_HOLD_MS;
   setTiming({remaining:MANUAL_STEP_HOLD_MS,total:MANUAL_STEP_HOLD_MS});
   setPlayback("running");
  }
  setTimerRevision(revision=>revision+1);
 };
 const completedThrough=playback==="completed"?steps.length-1:Math.max(-1,active-1);
 const progressStart=Math.max(0,Math.min(1,1-(timing.remaining/Math.max(1,timing.total))));
 return <>
 <section ref={sectionRef} id="service-flow" className="service-flow" aria-labelledby="service-flow-title" tabIndex={-1} style={{"--flow-step-duration":`${timing.remaining}ms`,"--flow-progress-start":progressStart} as CSSProperties}>
  <div className="service-flow__header"><div className="service-flow__intro"><p>INCIDENT RESPONSE FLOW</p><h2 id="service-flow-title"><span>위험 발견을</span><span>사건 대응으로 연결합니다</span></h2><p className="service-flow__description"><span>AI 탐지 결과를 하나의 사건으로 전환하고</span><span>관제 판단과 출동 배정, 현장 조치 결과를 실시간으로 이어 관리합니다</span></p></div></div>
  <div className="response-showcase" onMouseEnter={()=>setIsHovering(true)} onMouseLeave={()=>setIsHovering(false)} onFocusCapture={handleFocusCapture} onBlurCapture={handleBlurCapture}>
   <nav className="response-step-nav" aria-label="대응 프로세스 단계">{workflowGroups.map(group=><div className={`response-step-group response-step-group--${group.stepIndexes.length}`} key={group.label}><p>{group.label}</p><div>{group.stepIndexes.map(index=>{
    const item=steps[index];
    const state=index<=completedThrough?"completed":index===active&&playback!=="completed"?"current":"upcoming";
    return <button type="button" key={item.number} className={`${active===index?"is-active ":""}is-${state}`} aria-current={active===index?"step":undefined} aria-pressed={active===index} onClick={()=>handleManualStep(index)}><span className="response-step-nav__number">{state==="completed"?<CheckIcon/>:item.number}</span><span className="response-step-nav__label"><strong>{item.title}</strong><small>{item.shortDescription}</small></span><i><ChevronIcon direction="right"/></i>{state==="current"&&isProgressing?<span className="response-step-nav__progress" aria-hidden="true"/>:null}</button>;
   })}</div></div>)}</nav>
   <article className={`response-showcase__panel response-showcase__panel--${step.kind}`} key={step.number}>
    <div className="response-panel__copy"><header><div><p>STEP {step.number}</p><h3>{step.title}</h3></div></header><p className="response-step-question">{step.question}</p><p className={`response-incident-context${active===steps.length-1?" is-complete":""}`}><strong>{active===0?"CAM 07 탐지 후보":"사건 INC-2026-0715"}</strong><span>{active===0?"사건 생성 대기":active===steps.length-1?"현장 조치 완료":"동일 사건 처리 중"}</span></p><p className="response-step-description">{step.description}</p><dl className="response-step-details"><div><dt><i><DetailIcon type="input"/></i><span>확인 정보</span></dt><dd>{step.input}</dd></div><div><dt><i><DetailIcon type="process"/></i><span>처리 내용</span></dt><dd>{step.process}</dd></div><div><dt><i><DetailIcon type="result"/></i><span>현재 결과</span></dt><dd>{step.result}</dd></div></dl><div className="response-step-tags">{step.tags.map(tag=><span key={tag}>{tag}</span>)}</div></div>
    <ProductPreview kind={step.kind}/>
   </article>
  </div>
 </section>
 </>}
