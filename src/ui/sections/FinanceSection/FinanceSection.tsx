import type { FinanceContent } from "@/core";
import { OrbMark } from "../../brand";
import { ArrowFlow, Container, Section, SectionHead } from "../../components";
import { FinanceProductCard } from "./FinanceProductCard";
import "./finance.css";

/** SERVICE 03 — 매출선정산 · 미래매출선지급 */
export function FinanceSection({ content }: { content: FinanceContent }) {
  const { orbitBand } = content;
  return (
    <Section className="section--s3">
      <Container>
        <SectionHead intro={content.intro} />
        <div className="fin-grid block-narrow">
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
        <div className="orbit-band block-narrow">
          <span className="orbit-band__label">{orbitBand.label}</span>
          <strong>
            <ArrowFlow parts={orbitBand.flow} />
          </strong>
          <em>{orbitBand.tagline}</em>
          <OrbMark />
        </div>
      </Container>
    </Section>
  );
}
