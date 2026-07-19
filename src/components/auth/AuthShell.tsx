import type { ReactNode } from "react";
import styles from "./AuthShell.module.css";

type Props = {
  visual: ReactNode;
  children: ReactNode;
  pageClassName: string;
  panelClassName: string;
  panelLabel: string;
};

export function AuthShell({ visual, children, pageClassName, panelClassName, panelLabel }: Props) {
  return <main className={`${styles.page} ${pageClassName}`}>{visual}<section className={panelClassName} aria-label={panelLabel}>{children}</section></main>;
}
