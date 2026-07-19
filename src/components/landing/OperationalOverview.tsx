"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type OperationTone = "teal" | "blue" | "warm";
type OperationKey = "vision" | "control" | "field";
type FlowPhase = "active" | "handoff" | "complete";

type OperationStep = {
  id: OperationKey;
  stepNumber: string;
  title: string;
  englishLabel: string;
  description: string;
  panelTitle: string;
  panelItems: [string, string, string];
  handoffLabel?: string;
  tone: OperationTone;
  accentColor: string;
  panelBackground: string;
  recordStage: string;
  syncStatus: string;
  tags: [string, string];
};

const operationSteps: OperationStep[] = [
  {
    id: "vision",
    stepNumber: "01",
    title: "AI 위험 탐지",
    englishLabel: "AI DETECTION",
    description: "CCTV에서 위험 객체를 분류합니다.",
    panelTitle: "CCTV에서 위험 객체를 분류합니다.",
    panelItems: ["CCTV 실시간 영상 분석", "낙하물·야생동물·이륜차 분류", "위험 점수와 탐지 근거 생성"],
    handoffLabel: "사건 자동 생성",
    tone: "teal",
    accentColor: "#26999E",
    panelBackground: "#E5F0ED",
    recordStage: "AI 탐지",
    syncStatus: "분석 중",
    tags: ["위험 객체 분류", "탐지 근거 생성"],
  },
  {
    id: "control",
    stepNumber: "02",
    title: "관제 판단",
    englishLabel: "CONTROL CENTER",
    description: "AI 근거를 검토하고 대응을 결정합니다.",
    panelTitle: "AI 근거를 검토하고 대응을 결정합니다.",
    panelItems: ["탐지 이미지와 AI 신뢰도 확인", "실제 위험 여부와 출동 필요성 판정", "담당 관제자 선점 및 출동 담당자 배정"],
    handoffLabel: "출동 요청 전달",
    tone: "blue",
    accentColor: "#3C6FE8",
    panelBackground: "#E8EDF7",
    recordStage: "관제 판단",
    syncStatus: "관제 화면 공유",
    tags: ["위험 여부 판단", "담당자 배정"],
  },
  {
    id: "field",
    stepNumber: "03",
    title: "현장 대응",
    englishLabel: "FIELD RESPONSE",
    description: "출동부터 조치 완료까지 결과를 기록합니다.",
    panelTitle: "출동부터 조치 결과까지 기록합니다.",
    panelItems: ["출동 요청 수락 및 진행 상태 공유", "현장 도착과 조치 상태 등록", "조치 결과와 전후 사진 기록"],
    tone: "warm",
    accentColor: "#D89A3D",
    panelBackground: "#F3EDE3",
    recordStage: "현장 대응",
    syncStatus: "출동팀 공유",
    tags: ["상태 등록", "조치 결과 공유"],
  },
];

const completionStep = {
  panelTitle: "탐지부터 현장 조치까지 하나의 사건 기록으로 연결되었습니다.",
  panelItems: ["AI 탐지 근거 저장", "관제 판정 및 출동 이력 저장", "현장 조치 결과 실시간 공유"] as const,
  panelBackground: "#EEF2F0",
  accentColor: "#26947E",
  recordStage: "조치 완료",
  syncStatus: "기록 동기화 완료",
};

const ACTIVE_DURATION = 3500;
const HANDOFF_DURATION = 700;
const COMPLETE_DURATION = 2000;
const MANUAL_PAUSE_DURATION = 1500;

function RoleIcon({ type }: { type: OperationKey }) {
  if (type === "vision") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><circle cx="12" cy="12" r="3.2" /></svg>;
  if (type === "control") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="m9 10 2 2 4-4M8 21h8M12 17v4" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><path d="m9 10 2 2 4-4" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 12.5 3.5 3.5 7.5-8" /></svg>;
}

function IncidentRecord({ stage, syncStatus }: { stage: string; syncStatus: string }) {
  const coreFields = [
    ["사건 번호", "RB-260714-0821"],
    ["객체 유형", "낙하물"],
    ["위험도", "높음", "danger"],
    ["위치", "중부고속도로 137.4K"],
    ["현재 단계", stage, "progress"],
    ["동기화 상태", syncStatus, "live"],
  ] as const;
  const supportFields = [["담당 관제자", "배정 완료"], ["출동 상태", "담당자 배정 대기"], ["최근 업데이트", "08:28:02"]] as const;

  return <article className="operation-record" aria-labelledby="operation-record-title">
    <header><div><p>SHARED INCIDENT RECORD</p><h3 id="operation-record-title">하나의 사건 기록</h3></div><span className="operation-record__status"><i />실시간 공유</span></header>
    <dl>{coreFields.map(([label, value, state]) => <div key={label}><dt>{label}</dt><dd className={state ? `is-${state}` : undefined}>{value}</dd></div>)}</dl>
    <dl className="operation-record__support">{supportFields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </article>;
}

export function OperationalOverview() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState<FlowPhase>("active");
  const [isPointerPaused, setIsPointerPaused] = useState(false);
  const [isFocusPaused, setIsFocusPaused] = useState(false);
  const [isManualPaused, setIsManualPaused] = useState(false);
  const [cycleVersion, setCycleVersion] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPaused = isPointerPaused || isFocusPaused || isManualPaused;
  const activeStep = operationSteps[activeIndex];
  const isComplete = phase === "complete";

  useEffect(() => {
    if (isPaused) return;

    const duration = phase === "active" ? ACTIVE_DURATION : phase === "handoff" ? HANDOFF_DURATION : COMPLETE_DURATION;
    timerRef.current = setTimeout(() => {
      if (phase === "active") {
        if (activeIndex === operationSteps.length - 1) setPhase("complete");
        else setPhase("handoff");
      } else if (phase === "handoff") {
        setActiveIndex((index) => index + 1);
        setPhase("active");
      } else {
        setActiveIndex(0);
        setPhase("active");
      }
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [activeIndex, phase, isPaused, cycleVersion]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (manualPauseTimerRef.current) clearTimeout(manualPauseTimerRef.current);
  }, []);

  const selectStep = (index: number) => {
    if (index !== activeIndex || phase !== "active") {
      setActiveIndex(index);
      setPhase("active");
    }
    setCycleVersion((version) => version + 1);
    setIsManualPaused(true);
    if (manualPauseTimerRef.current) clearTimeout(manualPauseTimerRef.current);
    manualPauseTimerRef.current = setTimeout(() => setIsManualPaused(false), MANUAL_PAUSE_DURATION);
  };

  const completedCount = isComplete ? operationSteps.length : activeIndex;
  const panelTitle = isComplete ? completionStep.panelTitle : activeStep.panelTitle;
  const panelItems = isComplete ? completionStep.panelItems : activeStep.panelItems;
  const recordStage = isComplete ? completionStep.recordStage : activeStep.recordStage;
  const syncStatus = isComplete ? completionStep.syncStatus : activeStep.syncStatus;
  const panelStyle = {
    "--operation-panel-background": isComplete ? completionStep.panelBackground : activeStep.panelBackground,
    "--operation-panel-accent": isComplete ? completionStep.accentColor : activeStep.accentColor,
  } as CSSProperties;

  return <section className="operational-overview" aria-labelledby="operational-overview-title">
    <div className="operational-overview__copy">
      <p>OPERATIONAL OVERVIEW</p>
      <h2 id="operational-overview-title">
        <span>사건 대응 전 과정을</span>{" "}
        <span>하나로 관리합니다</span>
      </h2>
      <p className="operational-overview__flow">AI 탐지 · 관제 판단 · 현장 조치</p>
    </div>
    <div
      className={`operation-system operation-system--${phase}`}
      aria-label="AI 위험 탐지부터 현장 대응까지의 통합 사건 운영 구조"
      onMouseEnter={() => setIsPointerPaused(true)}
      onMouseLeave={() => setIsPointerPaused(false)}
      onFocusCapture={() => setIsFocusPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFocusPaused(false);
      }}
    >
      <div className="operation-system__roles">
        {operationSteps.map((item, index) => {
          const isActive = !isComplete && activeIndex === index;
          const isCompleted = index < completedCount;
          return <div className="operation-role-wrap" key={item.id}>
            <button
              type="button"
              className={`operation-role operation-role--${item.tone} ${isActive ? "is-selected" : ""} ${isCompleted ? "is-completed" : ""}`}
              aria-current={isActive ? "step" : undefined}
              aria-label={`${item.stepNumber} ${item.title}${isCompleted ? ", 완료" : isActive ? ", 현재 단계" : ", 대기"}`}
              onClick={() => selectStep(index)}
            >
              <header><span className="operation-role__number">{item.stepNumber}</span><span className="operation-role__icon">{isCompleted ? <CheckIcon /> : <RoleIcon type={item.id} />}</span></header>
              <p>{item.englishLabel}</p><h3>{item.title}</h3><strong>{item.description}</strong>
              <div className="operation-role__tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            </button>
            {index < operationSteps.length - 1 && <div className={`operation-transfer operation-transfer--${item.tone} ${phase === "handoff" && activeIndex === index ? "is-transferring" : ""} ${index < completedCount || isComplete ? "is-completed" : ""}`} aria-label={item.handoffLabel}>
              <i><b aria-hidden="true" /></i><span>{item.handoffLabel}</span>
            </div>}
          </div>;
        })}
      </div>
      <section key={isComplete ? "complete" : activeStep.id} className={`operation-selection ${isComplete ? "is-complete" : `operation-selection--${activeStep.tone}`}`} style={panelStyle} aria-live="polite">
        <p>{isComplete ? "통합 대응 완료" : `현재 선택 단계 · ${activeStep.title}`}</p>
        <h3>{panelTitle}</h3>
        <ul>{panelItems.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <IncidentRecord stage={recordStage} syncStatus={syncStatus} />
    </div>
  </section>;
}
