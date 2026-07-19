"use client";

import type { KeyboardEvent } from "react";
import type { LoginIntent } from "@/types/auth";
import styles from "./AuthIntentTabs.module.css";

type Props = { intent: LoginIntent; onChange: (intent: LoginIntent) => void };

export function AuthIntentTabs({ intent, onChange }: Props) {
  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = intent === "general" ? "operations" : "general";
    onChange(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-intent="${next}"]`)?.focus();
  };
  return <div className={styles.tabs} data-login-tabs role="tablist" aria-label="접속 목적" onKeyDown={handleKeys}>
    <button data-intent="general" type="button" role="tab" aria-selected={intent === "general"} onClick={() => onChange("general")}>일반 계정</button>
    <button data-intent="operations" type="button" role="tab" aria-selected={intent === "operations"} onClick={() => onChange("operations")}>운영 계정</button>
    <span className={styles.indicator} data-position={intent} aria-hidden="true" />
  </div>;
}
