"use client";

import type { CSSProperties } from "react";
import type { AuthRiskSlide } from "./authRiskSlides";
import styles from "./AuthRiskSelector.module.css";

type Props = {
  activeIndex: number;
  animationKey: number;
  intervalMs: number;
  options: AuthRiskSlide[];
  panelId: string;
  paused: boolean;
  reducedMotion: boolean;
  className?: string;
  onSelect: (index: number) => void;
};

type IntervalStyle = CSSProperties & { "--risk-interval": string };

export function AuthRiskSelector({ activeIndex, animationKey, intervalMs, options, panelId, paused, reducedMotion, className = "", onSelect }: Props) {
  return <nav className={`${styles.selector} ${paused ? styles.paused : ""} ${reducedMotion ? styles.reduced : ""} ${className}`.trim()} role="tablist" aria-label="위험 유형 선택" style={{ "--risk-interval": `${intervalMs}ms` } as IntervalStyle}>
    {options.map((option, index) => <button key={option.id} type="button" role="tab" aria-selected={index === activeIndex} aria-controls={panelId} className={index === activeIndex ? styles.active : ""} onClick={() => onSelect(index)}>
      <span>{option.name}</span>
      {index === activeIndex && <i key={`${option.id}-${animationKey}`} className={styles.progress} aria-hidden="true" />}
    </button>)}
  </nav>;
}
