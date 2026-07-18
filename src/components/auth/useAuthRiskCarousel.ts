"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authRiskSlides } from "./authRiskSlides";

export function useAuthRiskCarousel({ autoplay = true, desktopIntervalMs = 6000, mobileIntervalMs = 6000 } = {}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mobile, setMobile] = useState(false);
  const wasPaused = useRef(false);
  const paused = hovered || focusPaused || !pageVisible || reducedMotion;
  const intervalMs = mobile ? mobileIntervalMs : desktopIntervalMs;

  useEffect(() => {
    const stored = Number(window.sessionStorage.getItem("roadbogo-auth-risk-index"));
    if (Number.isInteger(stored) && stored >= 0 && stored < authRiskSlides.length) setActiveIndex(stored);
  }, []);
  const selectSlide = useCallback((index: number) => {
    const next = (index + authRiskSlides.length) % authRiskSlides.length;
    setActiveIndex(next);
    window.sessionStorage.setItem("roadbogo-auth-risk-index", String(next));
    setAnimationKey((key) => key + 1);
  }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const width = window.matchMedia("(max-width: 767px)");
    const updateMotion = () => setReducedMotion(motion.matches);
    const updateWidth = () => setMobile(width.matches);
    const updateVisibility = () => setPageVisible(document.visibilityState === "visible");
    updateMotion();
    updateWidth();
    updateVisibility();
    motion.addEventListener("change", updateMotion);
    width.addEventListener("change", updateWidth);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      motion.removeEventListener("change", updateMotion);
      width.removeEventListener("change", updateWidth);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (wasPaused.current && !paused) setAnimationKey((key) => key + 1);
    wasPaused.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!autoplay || paused || authRiskSlides.length < 2) return;
    const timer = window.setTimeout(() => selectSlide(activeIndex + 1), intervalMs);
    return () => window.clearTimeout(timer);
  }, [activeIndex, animationKey, autoplay, intervalMs, paused, selectSlide]);

  return { activeIndex, animationKey, intervalMs, mobile, paused, reducedMotion, selectSlide, setHovered, setFocusPaused };
}
