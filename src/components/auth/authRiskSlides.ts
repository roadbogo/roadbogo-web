import type { NormalizedBBox } from "@/components/landing/DetectionOverlay";

export type AuthRiskSlide = {
  id: "debris" | "wildlife" | "motorcycle";
  type: "DEBRIS" | "WILDLIFE" | "MOTORCYCLE";
  name: string;
  imageSrc: string;
  alt: string;
  label: string;
  confidence: number;
  headline: [string, string];
  description: [string, string];
  operationsHeadline: [string, string];
  signupHeadline: [string, string];
  cctvName: string;
  roadName: string;
  desktopPosition: number;
  signupDesktopPosition: number;
  mobilePosition: number;
  bbox: NormalizedBBox;
  candidates: NormalizedBBox[];
};

export const AUTH_RISK_IMAGE_SIZE = { width: 1672, height: 941 };

export const authRiskSlides: AuthRiskSlide[] = [
  { id: "debris", type: "DEBRIS", name: "낙하물", imageSrc: "/images/login-carousel/login-debris.jpg", alt: "고속도로 차로 위 타이어 낙하물 위험 상황", label: "낙하물 감지", confidence: 94, headline: ["도로 위 낙하물을 먼저 발견해", "신속한 관제 대응으로 연결합니다"], description: ["주행 차로의 위험 요소를 감지하고", "관제 판단부터 현장 조치까지 이어갑니다"], operationsHeadline: ["도로 위 낙하물을 감지해", "신속한 조치를 지원합니다"], signupHeadline: ["도로 위 낙하물을 감지해", "2차 사고 위험을 줄입니다"], cctvName: "CCTV-021", roadName: "중부고속도로", desktopPosition: 0.54, signupDesktopPosition: 0.7, mobilePosition: 0.82, bbox: { x: 0.701, y: 0.525, width: 0.04, height: 0.043 }, candidates: [{ x: 0.49, y: 0.45, width: 0.12, height: 0.12 }, { x: 0.17, y: 0.54, width: 0.2, height: 0.16 }] },
  { id: "wildlife", type: "WILDLIFE", name: "야생동물", imageSrc: "/images/login-carousel/login-wildlife.jpg", alt: "고속도로에 진입해 횡단하는 야생 사슴 위험 상황", label: "야생동물 감지", confidence: 89, headline: ["도로 위 야생동물 출현을 포착해", "충돌 위험 대응을 앞당깁니다"], description: ["갑작스러운 도로 진입을 감지하고", "관제 판단과 현장 대응을 연결합니다"], operationsHeadline: ["야생동물 진입을 포착해", "관제 대응을 앞당깁니다"], signupHeadline: ["야생동물 진입을 감지해", "돌발 위험에 빠르게 대응합니다"], cctvName: "CCTV-014", roadName: "영동고속도로", desktopPosition: 0.56, signupDesktopPosition: 0.63, mobilePosition: 0.82, bbox: { x: 0.677, y: 0.507, width: 0.091, height: 0.093 }, candidates: [{ x: 0.45, y: 0.45, width: 0.12, height: 0.13 }, { x: 0.82, y: 0.4, width: 0.09, height: 0.11 }] },
  { id: "motorcycle", type: "MOTORCYCLE", name: "이륜차", imageSrc: "/images/login-carousel/login-motorcycle.jpg", alt: "고속도로 위 탐지 대상 이륜차 위험 상황", label: "이륜차 감지", confidence: 91, headline: ["도로 위 이륜차를 빠르게 감지해", "위험 상황 대응으로 연결합니다"], description: ["차량 흐름 속 이륜차를 식별하고", "관제 판단부터 현장 대응까지 이어갑니다"], operationsHeadline: ["이륜차 진입을 감지해", "관제 대응을 앞당깁니다"], signupHeadline: ["이륜차 진입을 감지해", "대응 시간을 앞당깁니다"], cctvName: "CCTV-008", roadName: "경부고속도로", desktopPosition: 0.55, signupDesktopPosition: 0.62, mobilePosition: 0.82, bbox: { x: 0.676, y: 0.385, width: 0.041, height: 0.11 }, candidates: [{ x: 0.36, y: 0.43, width: 0.13, height: 0.12 }, { x: 0.8, y: 0.27, width: 0.08, height: 0.11 }] },
];
