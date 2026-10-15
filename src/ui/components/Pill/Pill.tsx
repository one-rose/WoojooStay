import type { ReactNode } from "react";
import { cx } from "@/shared";
import styles from "./Pill.module.css";

export type PillVariant = "section" | "small" | "soft" | "tint" | "date" | "number" | "inverse";

interface PillProps {
  variant?: PillVariant;
  className?: string;
  children: ReactNode;
}

/** 알약 모양 라벨 (섹션 이름표, 상태 표시 등) */
export function Pill({ variant = "section", className, children }: PillProps) {
  return <span className={cx(styles.pill, styles[variant], className)}>{children}</span>;
}
