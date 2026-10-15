import type { RoadmapStep } from "@/core";
import { cx } from "@/shared";
import { OrbMark } from "../../brand";
import { LineIcon } from "../../components";
import styles from "./RoadmapStepCard.module.css";

interface RoadmapStepCardProps {
  step: RoadmapStep;
  order: number;
  brandPrefix: string;
  /** 지금 제공 중인 단계 (강조 카드) */
  current: boolean;
  /** 진행 점에 불이 켜진 단계 */
  lit: boolean;
}

export function RoadmapStepCard({ step, order, brandPrefix, current, lit }: RoadmapStepCardProps) {
  return (
    <li className={cx(styles.step, current && styles.current, lit && styles.lit)}>
      <span className={styles.dot}>{String(order).padStart(2, "0")}</span>
      <div className={styles.card}>
        <span className={cx(styles.badge, !step.badge && styles.empty)}>{step.badge}</span>
        <strong className={styles.name}>
          {brandPrefix} <br />
          {step.name}
        </strong>
        <span className={styles.tags}>
          {step.tags[0]} <br />
          {step.tags[1]}
        </span>
        <span className={styles.icon} aria-hidden="true">
          {step.icon === "brand" ? <OrbMark className={styles.orb} /> : <LineIcon name={step.icon} />}
        </span>
      </div>
    </li>
  );
}
