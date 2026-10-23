import type { AiReviewContent } from "@/core";
import { OrbMark } from "../../brand";
import { Container, Lines, Pill, Section } from "../../components";
import { ReviewPanel } from "./ReviewPanel";
import "./ai-review.css";

/** SERVICE 01 — AI 고객 리뷰 자동답변 */
export function AiReviewSection({ content }: { content: AiReviewContent }) {
  return (
    <Section id="service" className="section--s1">
      <Container className="s1">
        <div className="s1__copy">
          <Pill modifiers={["lg"]}>{content.eyebrow}</Pill>
          <h2 className="sec-title sec-title--tight">{content.title}</h2>
          <p className="sec-desc">
            <Lines lines={content.description} />
          </p>
          <ul className="features">
            {content.features.map((feature) => (
              <li key={feature.title}>
                <span className="features__icon">
                  <OrbMark />
                </span>
                <div>
                  <strong>{feature.title}</strong>
                  <p>{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <ReviewPanel panel={content.panel} callout={content.callout} />
      </Container>
    </Section>
  );
}
