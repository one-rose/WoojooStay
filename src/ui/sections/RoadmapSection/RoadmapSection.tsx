import type { RoadmapContent } from "@/core";
import { Container, Lines, Pill } from "../../components";
import { GrowthLogic } from "./GrowthLogic";
import { RoadmapStepCard } from "./RoadmapStepCard";
import styles from "./RoadmapSection.module.css";

/** 앞의 두 단계(NOW·NEXT)는 불이 켜진 점으로 표시 */
const LIT_STEP_COUNT = 2;

/** 로드맵 — 6단계 확장 순서 + 성장 논리 */
export function RoadmapSection({ content }: { content: RoadmapContent }) {
  return (
    <section className={styles.section}>
      <Container>
        <Pill variant="inverse">{content.eyebrow}</Pill>
        <h2 className={styles.title}>{content.title}</h2>
        <p className={styles.description}>
          <Lines lines={content.description} collapseOnTablet />
        </p>
      </Container>

      <div className={styles.track}>
        <Container>
          <ol className={styles.steps}>
            {content.steps.map((step, i) => (
              <RoadmapStepCard
                key={step.name}
                step={step}
                order={i + 1}
                brandPrefix={content.brandPrefix}
                current={i === 0}
                lit={i < LIT_STEP_COUNT}
              />
            ))}
          </ol>
        </Container>
      </div>

      <Container>
        <GrowthLogic content={content.growth} />
      </Container>
    </section>
  );
}
