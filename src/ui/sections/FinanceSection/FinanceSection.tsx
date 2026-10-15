import type { FinanceContent } from "@/core";
import { OrbMark } from "../../brand";
import { ArrowFlow, Container, Section, SectionIntro } from "../../components";
import { FinanceProductCard } from "./FinanceProductCard";
import styles from "./FinanceSection.module.css";

/** SERVICE 03 — 매출선정산 · 미래매출선지급 */
export function FinanceSection({ content }: { content: FinanceContent }) {
  return (
    <Section className={styles.section}>
      <Container>
        <SectionIntro intro={content.intro} />

        <div className={styles.products}>
          {content.products.map((product) => (
            <FinanceProductCard
              key={product.name}
              product={product}
              brandPrefix={content.brandPrefix}
              flowCaption={content.flowCaption}
              flow={content.flow}
            />
          ))}
        </div>

        <div className={styles.band}>
          <span className={styles.bandLabel}>{content.orbitBand.label}</span>
          <strong>
            <ArrowFlow parts={content.orbitBand.flow} />
          </strong>
          <em>{content.orbitBand.tagline}</em>
          <OrbMark className={styles.bandMark} />
        </div>
      </Container>
    </Section>
  );
}
