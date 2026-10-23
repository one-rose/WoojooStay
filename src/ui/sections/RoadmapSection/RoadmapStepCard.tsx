import type { RoadmapStep } from "@/core";
import { cx } from "@/shared";
import { OrbMark } from "../../brand";
import { StepIcon } from "../../components";

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
    <li className={cx("step", current && "step--now", lit && "step--lit")}>
      <span className="step__dot">{String(order).padStart(2, "0")}</span>
      <div className="step__card">
        <span className={cx("step__badge", !step.badge && "is-empty")}>{step.badge}</span>
        <strong>
          <span className="step__brand">{brandPrefix}</span>
          <br />
          {step.name}
        </strong>
        <span className="step__meta">
          {step.tags[0]} <br />
          {step.tags[1]}
        </span>
        <span className="step__icon">{step.icon === "brand" ? <OrbMark /> : <StepIcon name={step.icon} />}</span>
      </div>
    </li>
  );
}
