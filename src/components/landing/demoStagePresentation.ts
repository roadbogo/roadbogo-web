export type DemoStageKey =
  | "DETECTING"
  | "INCIDENT_CREATED"
  | "CONTROL_REVIEW"
  | "DISPATCH_ASSIGNING"
  | "DISPATCHED"
  | "ON_SCENE"
  | "ACTION_IN_PROGRESS"
  | "ACTION_COMPLETED"
  | "CLOSED";

export type DemoStagePresentation = {
  step: 1 | 2 | 3 | 4 | 5;
  workflowLabel: string;
  workflowDetail: string;
  currentTitle: string;
  description: string;
  nextLabel: string;
};

export type DemoStepState = "completed" | "current" | "pending";

export function getDemoStepState(index: number, currentIndex: number): DemoStepState {
  if (index < currentIndex) return "completed";
  if (index === currentIndex) return "current";
  return "pending";
}

export function getDemoStepMarker(index: number, state: DemoStepState) {
  return state === "completed" ? "✓" : String(index + 1);
}

export const demoStagePresentation: Record<DemoStageKey, DemoStagePresentation> = {
  DETECTING: {
    step: 1,
    workflowLabel: "AI 탐지",
    workflowDetail: "위험 후보 탐지 중",
    currentTitle: "위험 후보 탐지 중",
    description: "AI가 CCTV 영상에서 도로 위 위험 요소를 분석하고 있습니다.",
    nextLabel: "사건 생성",
  },
  INCIDENT_CREATED: {
    step: 2,
    workflowLabel: "사건 생성",
    workflowDetail: "사건 등록 완료",
    currentTitle: "신규 사건 생성",
    description: "탐지 결과가 관제자가 확인할 신규 사건으로 등록되었습니다.",
    nextLabel: "관제 판단",
  },
  CONTROL_REVIEW: {
    step: 3,
    workflowLabel: "관제 판단",
    workflowDetail: "위험 여부 검토 중",
    currentTitle: "관제 검토 중",
    description: "관제자가 AI 탐지 근거와 현장 위험 여부를 확인하고 있습니다.",
    nextLabel: "출동 연결",
  },
  DISPATCH_ASSIGNING: {
    step: 4,
    workflowLabel: "출동 연결",
    workflowDetail: "담당자 배정 중",
    currentTitle: "출동 담당자 배정 대기",
    description: "출동 담당자를 선택하고 요청 전달을 준비하고 있습니다.",
    nextLabel: "출동 요청",
  },
  DISPATCHED: {
    step: 4,
    workflowLabel: "출동 연결",
    workflowDetail: "현장 이동 중",
    currentTitle: "출동 진행 중",
    description: "출동 담당자가 사건 현장으로 이동하고 있습니다.",
    nextLabel: "현장 도착",
  },
  ON_SCENE: {
    step: 5,
    workflowLabel: "현장 대응",
    workflowDetail: "현장 확인 중",
    currentTitle: "현장 상황 확인 중",
    description: "출동 담당자가 현장 상황과 위험 요소를 확인하고 있습니다.",
    nextLabel: "조치 시작",
  },
  ACTION_IN_PROGRESS: {
    step: 5,
    workflowLabel: "현장 대응",
    workflowDetail: "현장 조치 중",
    currentTitle: "현장 조치 중",
    description: "위험 요소에 대한 현장 조치가 진행 중입니다.",
    nextLabel: "조치 완료",
  },
  ACTION_COMPLETED: {
    step: 5,
    workflowLabel: "현장 대응",
    workflowDetail: "관제 확인 대기",
    currentTitle: "조치 결과 확인",
    description: "현장 조치가 완료되어 관제자의 최종 확인을 기다리고 있습니다.",
    nextLabel: "사건 종료",
  },
  CLOSED: {
    step: 5,
    workflowLabel: "현장 대응",
    workflowDetail: "대응 완료",
    currentTitle: "대응 완료",
    description: "현장 조치와 관제 확인이 모두 완료되었습니다.",
    nextLabel: "완료",
  },
};

export const primaryDemoStageKeys = [
  "DETECTING",
  "INCIDENT_CREATED",
  "CONTROL_REVIEW",
  "DISPATCH_ASSIGNING",
  "ACTION_IN_PROGRESS",
] as const satisfies readonly DemoStageKey[];

export const demoWorkflow = [
  "AI 탐지",
  "사건 생성",
  "관제 판단",
  "출동 연결",
  "현장 대응",
] as const;
