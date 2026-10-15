import type { ReactNode } from "react";
import type { Lines as LinesValue } from "@/core";
import { cx } from "@/shared";
import { OrbMark } from "../../brand";
import { Lines } from "../../components";
import styles from "./OperationCard.module.css";

interface OperationCardProps {
  tone: "neutral" | "highlight";
  brandPrefix: string;
  name: string;
  description: LinesValue;
  panelTitle: string;
  children: ReactNode;
}

/** 알바관리·지출관리 카드의 공통 틀: 제목 + 설명 + 안쪽 패널 */
export function OperationCard({ tone, brandPrefix, name, description, panelTitle, children }: OperationCardProps) {
  return (
    <article className={cx(styles.card, styles[tone])}>
      <OrbMark className={styles.mark} />
      <h3 className={styles.name}>
        <span>{brandPrefix}</span> {name}
      </h3>
      <p className={styles.description}>
        <Lines lines={description} collapseOnTablet />
      </p>
      <div className={styles.panel}>
        <strong className={styles.panelTitle}>{panelTitle}</strong>
        {children}
      </div>
    </article>
  );
}
