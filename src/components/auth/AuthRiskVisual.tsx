"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DetectionOverlay } from "@/components/landing/DetectionOverlay";
import styles from "@/app/login/login.module.css";
import { AuthRiskSelector } from "./AuthRiskSelector";
import { AuthVisualInfoCard } from "./AuthVisualInfoCard";
import { AUTH_RISK_IMAGE_SIZE, authRiskSlides } from "./authRiskSlides";
import { useAuthRiskCarousel } from "./useAuthRiskCarousel";

type Props = { variant: "login" | "signup" };

const copy = {
  login: {
    title: <>AI가 먼저 발견하고,<br />대응은 더 빠르게</>,
    description: <>위험 탐지부터 관제 판단,<br />출동과 현장 조치까지 하나로 연결합니다.</>,
    preview: "낙하물 · 야생동물 · 이륜차 탐지 흐름 미리보기",
  },
  signup: {
    title: <>도로 위 안전을<br />함께 시작해요</>,
    description: <>도로보GO 이용에 필요한 정보를 남겨주시면<br />확인 후 접속 절차를 안내해 드립니다.</>,
    preview: "도로보GO가 확인하는 주요 위험 유형",
  },
};

export function AuthRiskVisual({ variant }: Props) {
  const visualRef = useRef<HTMLElement>(null);
  const pointerInteraction = useRef(false);
  const touchStart = useRef<number | null>(null);
  const [stage, setStage] = useState({ width: 0, height: 0, left: 0, top: 0 });
  const { activeIndex, animationKey, intervalMs, mobile, paused, reducedMotion, selectSlide, setHovered, setFocusPaused } = useAuthRiskCarousel();
  const slide = authRiskSlides[activeIndex];
  const content = copy[variant];
  const panelId = `${variant}-risk-panel`;

  useEffect(() => {
    const visual = visualRef.current;
    if (!visual) return;
    const update = () => {
      const width = visual.clientWidth;
      const height = visual.clientHeight;
      if (!width || !height) return;
      const scale = Math.max(width / AUTH_RISK_IMAGE_SIZE.width, height / AUTH_RISK_IMAGE_SIZE.height);
      const renderedWidth = AUTH_RISK_IMAGE_SIZE.width * scale;
      const renderedHeight = AUTH_RISK_IMAGE_SIZE.height * scale;
      const position = mobile ? slide.mobilePosition : slide.desktopPosition;
      setStage({ width: renderedWidth, height: renderedHeight, left: (width - renderedWidth) * position, top: (height - renderedHeight) / 2 });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(visual);
    return () => observer.disconnect();
  }, [mobile, slide]);

  return (
    <section ref={visualRef} className={styles.visual} aria-labelledby={`${variant}-brand-title`}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onPointerDown={() => { pointerInteraction.current = true; setFocusPaused(false); }} onPointerUp={() => { pointerInteraction.current = false; }}
      onFocusCapture={() => { if (!pointerInteraction.current) setFocusPaused(true); }} onBlurCapture={() => setFocusPaused(false)}
      onTouchStart={(event) => { touchStart.current = event.changedTouches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => { if (touchStart.current === null) return; const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current; if (Math.abs(distance) > 42) selectSlide(activeIndex + (distance < 0 ? 1 : -1)); touchStart.current = null; }}>
      <div id={panelId} className={styles.carouselImages} role="tabpanel" aria-label={`${slide.name} 위험 탐지 장면`}>
        {authRiskSlides.map((item, index) => <Image key={item.id} className={`${styles.roadImage} ${index === activeIndex ? styles.roadImageActive : ""}`} src={item.imageSrc} alt={item.alt} fill priority={index === 0} sizes="(max-width: 767px) 100vw, 62vw" style={{ objectPosition: `${(mobile ? item.mobilePosition : item.desktopPosition) * 100}% center` }} />)}
      </div>
      <div className={styles.visualOverlay} />
      <div key={`scan-${slide.id}-${animationKey}`} className={styles.scanLine} aria-hidden="true" />
      <Link className={styles.brand} href="/" aria-label="도로보GO 메인으로 이동"><Image src="/brand/roadbogo-logo-final.png" alt="도로보GO" width={170} height={48} priority /></Link>
      {stage.width > 0 && <div key={`detection-${slide.id}-${animationKey}`} className={styles.detectionStage} style={stage} aria-hidden="true">
        {slide.candidates.map((bbox, index) => <DetectionOverlay key={`${slide.id}-candidate-${index}`} objectType="vehicle" variant="normal" label="차량" confidence={87 - index * 4} bbox={bbox} className={styles[`candidate${index + 1}`]} />)}
        <DetectionOverlay objectType={slide.type} variant="danger" label={`${slide.name} 감지`} confidence={slide.confidence} bbox={slide.bbox} className={styles.riskDetection} compactLabel />
      </div>}
      <div className={styles.visualCopy}><p>ROAD FLOW INTELLIGENCE</p><h1 id={`${variant}-brand-title`}>{content.title}</h1><span>{content.description}</span></div>
      <AuthVisualInfoCard description={content.preview} />
      <AuthRiskSelector activeIndex={activeIndex} animationKey={animationKey} intervalMs={intervalMs} options={authRiskSlides} panelId={panelId} paused={paused} reducedMotion={reducedMotion} className={styles.riskSelectorPlacement} onSelect={selectSlide} />
    </section>
  );
}
