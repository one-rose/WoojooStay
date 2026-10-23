import type { RoadmapContent } from "@/core";
import { ArrowFlow, Container, Lines, Pill } from "../../components";
import { Illustration } from "../../media";
import { RoadmapStepCard } from "./RoadmapStepCard";
import "./roadmap.css";

/** 앞의 두 단계(NOW·NEXT)는 불이 켜진 점으로 표시 */
const LIT_STEP_COUNT = 2;

/** 로드맵 — 6단계 확장 순서 + 성장 논리 */
export function RoadmapSection({ content }: { content: RoadmapContent }) {
  const { growth } = content;
  return (
    <section className="roadmap">
      <Container>
        <Pill modifiers={["lg", "road"]}>{content.eyebrow}</Pill>
        <h2 className="roadmap__title">{content.title}</h2>
        <p className="roadmap__desc">
          <Lines lines={content.description} />
        </p>
      </Container>

      <div className="roadmap__track">
        <Container>
          <ol className="steps">
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
        <div className="growth">
          <span className="growth__label">{growth.label}</span>
          <strong className="growth__text">
            <ArrowFlow parts={growth.flow} />
          </strong>
          <ol className="growth__flow">
            {growth.nodes.map((node) => (
              <li key={node.label}>
                <span className="growth__node">
                  <Illustration id={node.illustration} />
                  <em>{node.label}</em>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
