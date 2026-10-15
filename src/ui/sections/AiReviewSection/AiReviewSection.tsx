import type { AiReviewContent } from "@/core";
import { OrbMark } from "../../brand";
import { Container, Lines, Pill, Section } from "../../components";
import { ReviewPanel } from "./ReviewPanel";
import styles from "./AiReviewSection.module.css";

/** SERVICE 01 — AI 자동리뷰댓글 */
export function AiReviewSection({ content }: { content: AiReviewContent }) {
  const { intro } = content;
  return (
    <Section id="service" className={styles.section}>
      <Container className={styles.layout}>
        <div className={styles.copy}>
          <Pill>{intro.eyebrow}</Pill>
          <h2 className={styles.title}>
            <Lines lines={intro.title} />
          </h2>
          <p className={styles.description}>
            <Lines lines={intro.description} collapseOnTablet />
          </p>
          <ul className={styles.features}>
            {content.features.map((feature) => (
              <li key={feature.title}>
                <span className={styles.featureIcon}>
                  <OrbMark className={styles.featureMark} />
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
