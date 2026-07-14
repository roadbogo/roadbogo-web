"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const incidentData = [
  { id: "fallen-object", label: "낙하물", detectionLabel: "낙하물 감지", score: 92, confidence: [89, 91, 92], image: "/images/incidents/fallen-object-realistic.png", incident: "RB-260714-0821", position: "debris", lane: "2차로 · 137.4K", objectStatus: "차로 내 정지" },
  { id: "wild-animal", label: "야생동물", detectionLabel: "야생동물 감지", score: 88, confidence: [85, 87, 88], image: "/images/incidents/wild-animal-realistic.png", incident: "RB-260714-0824", position: "wildlife", lane: "1차로 · 137.4K", objectStatus: "도로 진입" },
  { id: "motorcycle", label: "이륜차", detectionLabel: "이륜차 감지", score: 85, confidence: [82, 84, 85], image: "/images/incidents/motorcycle-realistic.png", incident: "RB-260714-0827", position: "motorcycle", lane: "갓길 인접 · 137.4K", objectStatus: "이동 중" },
] as const;

const steps = [
  { title: "위험 탐지", time: "08:21:04" },
  { title: "관제 판단", time: "08:21:18" },
  { title: "출동 연결", time: "08:21:32" },
  { title: "현장 조치", time: "08:26:47" },
] as const;
const rail = ["AI 탐지", "사건 생성", "관제 판단", "출동 연결", "현장 대응"];
const railTimes = ["08:26:47", "08:26:49", "08:27:18", "08:28:02", "08:34:12"];
const controlStates = ["AI 분석 중", "확인 대기", "관제 검토 중", "대응팀 연결", "현장 조치 중"];
const recommendedActions = ["사건 생성 준비", "관제 판단 진행", "위험 여부 승인", "출동 정보 확인", "조치 결과 확인"];
const INITIAL_TIME = 8 * 60 * 60 + 21 * 60 + 4;

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
  const scenario = incidentData[scenarioIndex];
  const confidence = scenario.confidence[confidenceIndex];
  const activeScene = Math.min(currentStep, steps.length - 1);

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
    <div className="incident-top"><div key={`heading-${scenario.id}`} className="scenario-fade"><span className="live-dot" /> LIVE INCIDENT <small>{scenario.incident}</small></div><div id="detection-types" className="scenario-picker" aria-label="탐지 유형">{incidentData.map((item, index) => <button key={item.id} className={scenarioIndex === index ? "is-active" : ""} aria-pressed={scenarioIndex === index} onClick={() => selectScenario(index)}>{item.label}</button>)}</div></div>
    <div className="incident-body"><div className="cctv-frame"><div className="cctv-meta"><span>CAM 07 · 중부고속도로 137.4K · LIVE</span><span>2026.07.14 · {formatTime(currentTime)}</span></div><div className="road-scene"><span className="road-line road-line--one" /><span className="road-line road-line--two" /><div key={transitionKey} className={`detected-object detected-object--${scenario.position}`}><span className="road-pulse" /><Image src={scenario.image} alt={scenario.label} width={92} height={72} /><strong>{scenario.detectionLabel} · {confidence}%</strong></div><div className="vehicle-box vehicle-box--one">vehicle · 98%</div><div className="vehicle-box vehicle-box--two">vehicle · 97%</div><div className="vehicle-box vehicle-box--three">vehicle · 96%</div><span className="camera-label">AI TRACKING · Objects 12 · Risk 01</span></div></div><article className="incident-card response-panel scenario-fade" key={`card-${scenario.id}`}>
      <section className="response-summary" aria-labelledby={`incident-${scenario.id}`}><div className="response-kicker"><span>LIVE INCIDENT</span><small>{scenario.incident}</small></div><h2 id={`incident-${scenario.id}`}>{scenario.detectionLabel}</h2><div className="response-chips"><span className="response-chip response-chip--danger">위험도 높음</span><span className="response-chip response-chip--score">AI {confidence}%</span><span className="response-chip">{formatTime(currentTime)}</span></div></section>
      <section className="response-field" aria-label="현장 정보"><h3>현장 정보</h3><ul><li><span>위치</span><strong>중부고속도로</strong></li><li><span>카메라</span><strong>CAM 07</strong></li><li><span>구간</span><strong>{scenario.lane}</strong></li><li><span>객체 상태</span><strong>{scenario.objectStatus}</strong></li></ul></section>
      <section className="response-status" aria-label="대응 상태"><div className="response-status__head"><span>대응 상태</span><i>LIVE</i></div><dl><div><dt>현재 단계</dt><dd>{rail[currentStep]}</dd></div><div><dt>관제 상태</dt><dd>{controlStates[currentStep]}</dd></div><div><dt>추천 조치</dt><dd>{recommendedActions[currentStep]}</dd></div></dl></section>
    </article></div>
    <div className="flow-rail" aria-label="처리 진행 단계">{rail.map((item, index) => <div key={item} className={index < currentStep ? "is-complete" : index === currentStep ? "is-current" : "is-pending"}><span>{index + 1}</span><strong>{item}</strong><small>{railTimes[index]}</small></div>)}</div>
    <div className="incident-carousel-controls" aria-label="사건 처리 장면 제어">
      <button type="button" className="incident-arrow" onClick={() => move(-1)} aria-label="이전 장면">←</button>
      <div className="incident-step-buttons">{steps.map((step, index) => <button type="button" key={step.title} className={activeScene === index ? "is-active" : ""} aria-pressed={activeScene === index} onClick={() => selectStep(index)}><span>0{index + 1}</span>{step.title}</button>)}</div>
      <button type="button" className="incident-arrow" onClick={() => move(1)} aria-label="다음 장면">→</button>
    </div>
  </section>;
}
