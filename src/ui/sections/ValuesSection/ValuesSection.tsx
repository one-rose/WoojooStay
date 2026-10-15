import type { ValuesContent } from "@/core";
import { DuoMark, OrbMark } from "../../brand";
import { Container, Lines, Pill, Section } from "../../components";
import styles from "./ValuesSection.module.css";

/** 핵심 가치 3가지 + 마무리 띠 */
export function ValuesSection({ content }: { content: ValuesContent }) {
  return (
    <Section id="value" className={styles.section}>
      <Container>
        <Pill variant="small">{content.eyebrow}</Pill>
        <h2 className={styles.title}>
          <Lines lines={content.title} />
        </h2>
        <p className={styles.description}>
          <Lines lines={content.description} collapseOnTablet />
        </p>

        <ul className={styles.values}>
          {content.items.map((item, i) => (
            <li key={item.title}>
              <Pill variant="number">{String(i + 1).padStart(2, "0")}</Pill>
              <strong>{item.title}</strong>
              <p>
                <Lines lines={item.description} />
              </p>
              <OrbMark className={styles.orb} />
            </li>
          ))}
        </ul>

        <div className={styles.band}>
          <div>
            <span>{content.band.eyebrow}</span>
            <strong>{content.band.message}</strong>
          </div>
          <DuoMark className={styles.duo} />
        </div>
      </Container>
    </Section>
  );
}
