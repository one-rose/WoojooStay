import type { ReactNode } from "react";
import { cx } from "@/shared";
import styles from "./PanelHeader.module.css";

interface PanelHeaderProps {
  title: string;
  /** 오른쪽에 놓을 상태 표시 (Pill 등) */
  aside?: ReactNode;
  /** 아래 구분선 없는 큰 제목형 */
  plain?: boolean;
}

/** 대시보드 패널 머리줄: 제목 + 오른쪽 상태 */
export function PanelHeader({ title, aside, plain = false }: PanelHeaderProps) {
  return (
    <div className={cx(styles.header, plain && styles.plain)}>
      <strong className={styles.title}>{title}</strong>
      {aside}
    </div>
  );
}
