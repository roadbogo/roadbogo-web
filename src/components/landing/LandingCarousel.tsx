"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { DetectionOverlay, type NormalizedBBox } from "./DetectionOverlay";

const incidentData = [
  { id: "fallen-object", label: "낙하물", detectionLabel: "낙하물 감지", score: 92, confidence: [89, 91, 92], image: "/images/incidents/fallen-object-realistic.png", incident: "RB-260714-0821", position: "debris", lane: "2차로 · 137.4K", objectStatus: "차로 내 정지" },
  { id: "wild-animal", label: "야생동물", detectionLabel: "야생동물 감지", score: 88, confidence: [85, 87, 88], image: "/images/incidents/wild-animal-realistic.png", incident: "RB-260714-0824", position: "wildlife", lane: "1차로 · 137.4K", objectStatus: "도로 진입" },
  { id: "motorcycle", label: "이륜차", detectionLabel: "이륜차 감지", score: 85, confidence: [82, 84, 85], image: "/images/incidents/motorcycle-realistic.png", incident: "RB-260714-0827", position: "motorcycle", lane: "137.4K 부근", objectStatus: "주행 중" },
] as const;

const steps = [
  { title: "위험 탐지", time: "08:21:04" },
  { title: "관제 판단", time: "08:21:18" },
  { title: "출동 연결", time: "08:21:32" },
  { title: "현장 조치", time: "08:26:47" },
] as const;
const rail = ["AI 탐지", "사건 생성", "관제 판단", "출동 연결", "현장 대응"];
const railDescriptions = ["위험 객체 분류 완료", "사건 정보 자동 구성", "AI 근거 검토 및 판정", "대응팀 연결 준비", "현장 조치 대기"];
const processingStages = ["위험 후보 분석 중", "사건 생성 완료", "관제 검토 중", "출동 배정 중", "현장 조치 중"];
const controlStates = ["분석 중", "확인 대기", "담당자 확인", "출동 정보 확인", "조치 결과 확인"];
const nextProcedures = ["사건 생성", "관제 판단", "출동 필요 여부 결정", "현장 대응", "처리 완료"];
const INITIAL_TIME = 8 * 60 * 60 + 21 * 60 + 4;
const ChevronIcon = ({direction}:{direction:"left"|"right"}) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={direction==="left"?"m15 18-6-6 6-6":"m9 18 6-6-6-6"}/></svg>;
type DetectionType = (typeof incidentData)[number]["id"];
type VehicleDetection = {
  id:string;
  label:string;
  confidence:number;
  bbox:NormalizedBBox;
};
const CCTV_SOURCE_SIZE={width:1280,height:720};
const vehicleDetections:VehicleDetection[]=[
  {id:"vehicle-02",label:"차량",confidence:97,bbox:{x:.3664,y:.0861,width:.1391,height:.1917}},
  {id:"vehicle-03",label:"차량",confidence:96,bbox:{x:.7,y:.3569,width:.24,height:.3278}},
];

function getCoverBBoxStyle(containerWidth:number,containerHeight:number,bbox:NormalizedBBox,rightInset=0):CSSProperties{
  const scale=Math.max(containerWidth/CCTV_SOURCE_SIZE.width,containerHeight/CCTV_SOURCE_SIZE.height);
  const renderedWidth=CCTV_SOURCE_SIZE.width*scale;
  const renderedHeight=CCTV_SOURCE_SIZE.height*scale;
  const cropX=(renderedWidth-containerWidth)*.56;
  const cropY=(renderedHeight-containerHeight)*.48;
  const rawLeft=(bbox.x*CCTV_SOURCE_SIZE.width*scale-cropX)/containerWidth;
  const rawTop=(bbox.y*CCTV_SOURCE_SIZE.height*scale-cropY)/containerHeight;
  const rawRight=rawLeft+(bbox.width*CCTV_SOURCE_SIZE.width*scale/containerWidth);
  const rawBottom=rawTop+(bbox.height*CCTV_SOURCE_SIZE.height*scale/containerHeight);
  const left=Math.max(0,Math.min(1,rawLeft));
  const top=Math.max(0,Math.min(1,rawTop));
  const right=Math.max(0,Math.min(1-rightInset/containerWidth,rawRight));
  const bottom=Math.max(0,Math.min(1,rawBottom));
  const visibleWidth=Math.max(0,right-left);
  const visibleHeight=Math.max(0,bottom-top);
  return {
    left:`${left*100}%`,
    top:`${top*100}%`,
    width:`${visibleWidth*100}%`,
    height:`${visibleHeight*100}%`,
    visibility:visibleWidth>=.04&&visibleHeight>=.04?"visible":"hidden",
  };
}

function DetectionTypeIcon({ type }: { type: DetectionType }) {
  if (type === "fallen-object") {
    return <svg className="scenario-picker__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8h14v11H5zM8 8V5h8v3M5 13h14" />
    </svg>;
  }

  if (type === "wild-animal") {
    return <svg className="scenario-picker__icon" viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="7" cy="7" rx="1.8" ry="2.3" />
      <ellipse cx="12" cy="5.5" rx="1.8" ry="2.3" />
      <ellipse cx="17" cy="7" rx="1.8" ry="2.3" />
      <path d="M7.5 17.2c0-3 2-5 4.5-5s4.5 2 4.5 5c0 1.6-1.2 2.8-2.8 2.8-.7 0-1.2-.3-1.7-.8-.5.5-1 .8-1.7.8-1.6 0-2.8-1.2-2.8-2.8Z" />
    </svg>;
  }

  return <svg className="scenario-picker__icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="6" cy="17" r="3" />
    <circle cx="18" cy="17" r="3" />
    <path d="m6 17 4-7h4l4 7m-8-7L8 7h3m3 3 2-3h3" />
  </svg>;
}

function formatTime(totalSeconds: number) {
  const normalized = totalSeconds % (24 * 60 * 60);
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const seconds = normalized % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function LandingCarousel() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(INITIAL_TIME);
  const [confidenceIndex, setConfidenceIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);
  const clockElapsed = useRef(0);
  const confidenceElapsed = useRef(0);
  const stepElapsed = useRef(0);
  const currentStepRef = useRef(0);
  const roadSceneRef = useRef<HTMLDivElement>(null);
  const [vehiclePositions,setVehiclePositions]=useState<Record<string,CSSProperties>>({});
  const scenario = incidentData[scenarioIndex];
  const confidence = scenario.confidence[confidenceIndex];
  const activeScene = Math.min(currentStep, steps.length - 1);

  useLayoutEffect(()=>{
    const scene=roadSceneRef.current;
    if(!scene)return;
    const updatePositions=()=>{
      const {width,height}=scene.getBoundingClientRect();
      if(!width||!height)return;
      setVehiclePositions(Object.fromEntries(
        vehicleDetections.map(detection=>[
          detection.id,
          getCoverBBoxStyle(width,height,detection.bbox,detection.id==="vehicle-03"?12:0),
        ]),
      ));
    };
    updatePositions();
    const observer=new ResizeObserver(updatePositions);
    observer.observe(scene);
    return()=>observer.disconnect();
  },[]);

  useEffect(() => {
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = now - lastTick;
      lastTick = now;
      clockElapsed.current += delta;
      confidenceElapsed.current += delta;
      stepElapsed.current += delta;

      if (clockElapsed.current >= 1000) {
        const elapsedSeconds = Math.floor(clockElapsed.current / 1000);
        clockElapsed.current -= elapsedSeconds * 1000;
        setCurrentTime((value) => value + elapsedSeconds);
      }
      if (confidenceElapsed.current >= 800) {
        confidenceElapsed.current %= 800;
        setConfidenceIndex((value) => Math.min(value + 1, scenario.confidence.length - 1));
      }
      if (stepElapsed.current >= 2000) {
        stepElapsed.current %= 2000;
        if (currentStepRef.current < rail.length - 1) {
          currentStepRef.current += 1;
          setCurrentStep(currentStepRef.current);
        } else {
          currentStepRef.current = 0;
          clockElapsed.current = 0;
          confidenceElapsed.current = 0;
          setCurrentStep(0);
          setCurrentTime(INITIAL_TIME);
          setConfidenceIndex(0);
          setScenarioIndex((value) => (value + 1) % incidentData.length);
          setAnimationKey((value) => value + 1);
        }
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [scenario.confidence.length]);

  const selectScenario = (index: number) => {
    clockElapsed.current = 0;
    confidenceElapsed.current = 0;
    stepElapsed.current = 0;
    setScenarioIndex(index);
    setCurrentTime(INITIAL_TIME);
    setConfidenceIndex(0);
    currentStepRef.current = 0;
    setCurrentStep(0);
    setAnimationKey((value) => value + 1);
  };
  const selectStep = (index: number) => {
    stepElapsed.current = 0;
    currentStepRef.current = Math.min(index, rail.length - 1);
    setCurrentStep(currentStepRef.current);
  };
  const move = (direction: number) => selectStep((activeScene + direction + steps.length) % steps.length);
  const transitionKey = `${scenario.id}-${animationKey}`;

  return <section id="incident-stage" tabIndex={0} onKeyDown={(event) => { if (event.key === "ArrowLeft") move(-1); if (event.key === "ArrowRight") move(1); }} className={`incident-stage incident-stage--${activeScene}`} aria-label="라이브 사건 처리 시연">
    <div className="incident-top"><div key={`heading-${scenario.id}`} className="scenario-fade"><span className="live-dot" /> AI 탐지 시연 <small>AI 위험 탐지 시연 · {scenario.incident}</small></div><div id="detection-types" className="scenario-picker" aria-label="탐지 유형">{incidentData.map((item, index) => <button key={item.id} className={scenarioIndex === index ? "is-active" : ""} aria-pressed={scenarioIndex === index} onClick={() => selectScenario(index)}><DetectionTypeIcon type={item.id} /><span>{item.label}</span></button>)}</div></div>
    <div className="incident-body"><div className="cctv-frame"><div className="cctv-meta"><div className="cctv-meta__source"><span className="cctv-meta__status" aria-hidden="true"/><strong>CAM 07</strong><i>·</i><span>중부고속도로 137.4K</span><em title="서비스 흐름을 보여주기 위한 시연 영상입니다." aria-label="서비스 흐름을 보여주기 위한 시연 영상입니다.">시연 모드</em></div><time>2026.07.14 · {formatTime(currentTime)}</time></div><div ref={roadSceneRef} className="road-scene"><span className="road-line road-line--one" /><span className="road-line road-line--two" /><div key={transitionKey} className={`detected-object detected-object--${scenario.position}`}><span className="road-pulse" /><Image src={scenario.image} alt={scenario.label} width={92} height={72} /><strong>{scenario.label} · {scenario.score}%</strong></div>{vehicleDetections.map(detection=><DetectionOverlay key={detection.id} objectType="vehicle" variant="normal" label={detection.label} confidence={detection.confidence} compactLabel animated={false} className={`vehicle-detection vehicle-detection--${detection.id}`} style={vehiclePositions[detection.id]}/>)}
      <span className="camera-label">AI TRACKING · Objects 12 · Risk 01</span></div></div><article className="incident-card response-panel scenario-fade" key={`card-${scenario.id}`}>
      <section className="response-summary" aria-labelledby={`incident-${scenario.id}`}><div className="response-kicker"><span>AI 위험 후보</span><small>{scenario.incident}</small></div><h2 id={`incident-${scenario.id}`}>{scenario.detectionLabel}</h2><div className="response-chips"><span className="response-chip response-chip--danger">위험도 높음</span><span className="response-chip response-chip--score">AI {confidence}%</span><span className="response-chip">{formatTime(currentTime)}</span></div></section>
      <section className="response-field" aria-label="현장 정보"><h3>현장 정보</h3><ul><li><span>위치</span><strong>중부고속도로</strong></li><li><span>카메라</span><strong>CAM 07</strong></li><li><span>구간</span><strong>{scenario.lane}</strong></li><li><span>객체 상태</span><strong>{scenario.objectStatus}</strong></li></ul></section>
      <section className="response-status" aria-label="처리 현황"><div className="response-status__head"><span>처리 현황</span></div><p className="response-status__current"><i aria-hidden="true"/><strong>{processingStages[currentStep]}</strong></p><dl><div><dt>관제 상태</dt><dd>{controlStates[currentStep]}</dd></div><div><dt>다음 절차</dt><dd>{nextProcedures[currentStep]}</dd></div></dl></section>
    </article></div>
    <div className="flow-rail" aria-label="실제 처리 진행 상태">{rail.map((item, index) => <div key={item} className={index < currentStep ? "is-complete" : index === currentStep ? "is-current" : "is-pending"} aria-current={index === currentStep ? "step" : undefined}><span>{index + 1}</span><strong>{item}</strong>{index === currentStep && <small>{railDescriptions[index]}</small>}</div>)}</div>
    <div className="incident-carousel-controls" aria-label="사건 처리 장면 제어">
      <button type="button" className="incident-arrow" onClick={() => move(-1)} aria-label="이전 장면"><ChevronIcon direction="left"/></button>
      <div className="incident-step-buttons" aria-label="시연 장면 선택">{steps.map((step, index) => { const state = index < activeScene ? "is-completed" : index === activeScene ? "is-current" : "is-upcoming"; return <button type="button" key={step.title} className={`${state} ${activeScene === index ? "is-active" : ""}`} aria-current={activeScene === index ? "step" : undefined} aria-pressed={activeScene === index} onClick={() => selectStep(index)}><span>0{index + 1}</span>{step.title}</button>; })}</div>
      <button type="button" className="incident-arrow" onClick={() => move(1)} aria-label="다음 장면"><ChevronIcon direction="right"/></button>
    </div>
  </section>;
}
