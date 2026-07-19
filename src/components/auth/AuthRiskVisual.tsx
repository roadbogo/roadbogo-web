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
import type { LoginIntent } from "@/types/auth";

type Props = { variant: "login" | "signup"; loginIntent?: LoginIntent };

export function AuthRiskVisual({ variant, loginIntent = "general" }: Props) {
  const visualRef = useRef<HTMLElement>(null);
  const pointerInteraction = useRef(false);
  const touchStart = useRef<number | null>(null);
  const [stage, setStage] = useState({ width: 0, height: 0, left: 0, top: 0 });
  const { activeIndex, animationKey, intervalMs, mobile, paused, reducedMotion, selectSlide, setHovered, setFocusPaused } = useAuthRiskCarousel();
  const slide = authRiskSlides[activeIndex];
  const operations = variant === "login" && loginIntent === "operations";
  const title = variant === "signup" ? slide.signupHeadline : operations ? slide.operationsHeadline : slide.headline;
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
      const position = mobile ? slide.mobilePosition : variant === "signup" ? slide.signupDesktopPosition : slide.desktopPosition;
      setStage({ width: renderedWidth, height: renderedHeight, left: (width - renderedWidth) * position, top: (height - renderedHeight) / 2 });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(visual);
    return () => observer.disconnect();
  }, [mobile, slide, variant]);

  return (
    <section ref={visualRef} className={`${styles.visual} ${variant === "signup" ? styles.signupVisual : styles.loginVisual} ${operations ? styles.operationsVisual : ""}`.trim()} aria-labelledby={`${variant}-brand-title`}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onPointerDown={() => { pointerInteraction.current = true; setFocusPaused(false); }} onPointerUp={() => { pointerInteraction.current = false; }}
      onFocusCapture={() => { if (!pointerInteraction.current) setFocusPaused(true); }} onBlurCapture={() => setFocusPaused(false)}
      onTouchStart={(event) => { touchStart.current = event.changedTouches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => { if (touchStart.current === null) return; const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current; if (Math.abs(distance) > 42) selectSlide(activeIndex + (distance < 0 ? 1 : -1)); touchStart.current = null; }}>
      <div id={panelId} className={styles.carouselImages} role="tabpanel" aria-label={`${slide.name} 위험 탐지 장면`}>
        {authRiskSlides.map((item, index) => <Image key={item.id} className={`${styles.roadImage} ${index === activeIndex ? styles.roadImageActive : ""}`} src={item.imageSrc} alt={item.alt} fill priority={index === 0} sizes="(max-width: 767px) 100vw, 62vw" style={{ objectPosition: `${(mobile ? item.mobilePosition : variant === "signup" ? item.signupDesktopPosition : item.desktopPosition) * 100}% center` }} />)}
      </div>
      <div className={styles.visualOverlay} />
      <div key={`scan-${slide.id}-${animationKey}`} className={styles.scanLine} aria-hidden="true" />
      <Link className={styles.brand} href="/" aria-label="도로보GO 메인으로 이동"><Image src="/brand/roadbogo-logo-final.png" alt="도로보GO" width={170} height={48} priority /></Link>
      {stage.width > 0 && <div key={`detection-${slide.id}-${animationKey}`} className={styles.detectionStage} style={stage} aria-hidden="true">
        {slide.candidates.map((bbox, index) => <DetectionOverlay key={`${slide.id}-candidate-${index}`} objectType="vehicle" variant="normal" label="차량" confidence={87 - index * 4} bbox={bbox} className={styles[`candidate${index + 1}`]} />)}
        <DetectionOverlay objectType={slide.type} variant="danger" label={slide.label} confidence={slide.confidence} bbox={slide.bbox} className={styles.riskDetection} compactLabel />
      </div>}
      <div key={`copy-${slide.id}-${animationKey}`} className={styles.visualCopy}><p>{variant === "signup" ? "AI RISK DETECTION" : operations ? "REAL-TIME OPERATIONS" : "ROAD FLOW INTELLIGENCE"}</p><h1 id={`${variant}-brand-title`}>{title.map(line=><span key={line}>{line}</span>)}</h1>{variant === "login" && !operations && <span>{slide.description.map(line=><span key={line}>{line}</span>)}</span>}</div>
      {variant === "login" && !operations && <AuthVisualInfoCard description={`${slide.name} 위험 탐지 · ${slide.roadName} ${slide.cctvName}`} />}
      <AuthRiskSelector activeIndex={activeIndex} animationKey={animationKey} intervalMs={intervalMs} options={authRiskSlides} panelId={panelId} paused={paused} reducedMotion={reducedMotion} className={styles.riskSelectorPlacement} placementStyle={mobile ? { left: "50%", right: "auto", transform: "translateX(-50%)" } : undefined} onSelect={selectSlide} />
    </section>
  );
}
