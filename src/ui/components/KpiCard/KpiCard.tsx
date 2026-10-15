import type { ReactNode } from "react";
import { cx } from "@/shared";
import styles from "./KpiCard.module.css";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  note: string;
  /** strong: 진한 강조 · soft: 연한 색 · accent: 포인트 색 */
  noteTone?: "strong" | "soft" | "accent";
  size?: "sm" | "lg";
}

/** 라벨 · 큰 숫자 · 보조 문구로 된 지표 카드 */
export function KpiCard({ label, value, note, noteTone = "strong", size = "sm" }: KpiCardProps) {
  return (
    <div className={cx(styles.card, styles[size])}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      <span className={cx(styles.note, styles[noteTone])}>{note}</span>
    </div>
  );
}
