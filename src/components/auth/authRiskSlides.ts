import type { NormalizedBBox } from "@/components/landing/DetectionOverlay";

export type AuthRiskSlide = {
  id: "debris" | "wildlife" | "motorcycle";
  type: "DEBRIS" | "WILDLIFE" | "MOTORCYCLE";
  name: string;
  imageSrc: string;
  alt: string;
  label: string;
  confidence: number;
  cctvName: string;
  roadName: string;
  desktopPosition: number;
  mobilePosition: number;
  bbox: NormalizedBBox;
  candidates: NormalizedBBox[];
};

export const AUTH_RISK_IMAGE_SIZE = { width: 1672, height: 941 };

export const authRiskSlides: AuthRiskSlide[] = [
  { id: "debris", type: "DEBRIS", name: "낙하물", imageSrc: "/images/login-carousel/login-debris.jpg", alt: "고속도로 차로 위 타이어 낙하물 위험 상황", label: "낙하물 위험 후보", confidence: 94, cctvName: "CCTV-021", roadName: "중부고속도로", desktopPosition: 0.54, mobilePosition: 0.58, bbox: { x: 0.699, y: 0.518, width: 0.045, height: 0.052 }, candidates: [{ x: 0.49, y: 0.45, width: 0.12, height: 0.12 }, { x: 0.17, y: 0.54, width: 0.2, height: 0.16 }] },
  { id: "wildlife", type: "WILDLIFE", name: "야생동물", imageSrc: "/images/login-carousel/login-wildlife.jpg", alt: "고속도로에 진입해 횡단하는 야생 사슴 위험 상황", label: "야생동물 위험 후보", confidence: 89, cctvName: "CCTV-014", roadName: "영동고속도로", desktopPosition: 0.56, mobilePosition: 0.61, bbox: { x: 0.677, y: 0.507, width: 0.091, height: 0.093 }, candidates: [{ x: 0.45, y: 0.45, width: 0.12, height: 0.13 }, { x: 0.82, y: 0.4, width: 0.09, height: 0.11 }] },
  { id: "motorcycle", type: "MOTORCYCLE", name: "이륜차", imageSrc: "/images/login-carousel/login-motorcycle.jpg", alt: "고속도로 위 탐지 대상 이륜차 위험 상황", label: "이륜차 위험 후보", confidence: 91, cctvName: "CCTV-008", roadName: "경부고속도로", desktopPosition: 0.55, mobilePosition: 0.6, bbox: { x: 0.676, y: 0.385, width: 0.041, height: 0.11 }, candidates: [{ x: 0.36, y: 0.43, width: 0.13, height: 0.12 }, { x: 0.8, y: 0.27, width: 0.08, height: 0.11 }] },
];
