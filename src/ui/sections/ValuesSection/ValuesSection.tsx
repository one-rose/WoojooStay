import type { ValuesContent } from "@/core";
import { DuoMark, OrbMark } from "../../brand";
import { Container, Lines, Pill, Section } from "../../components";
import "./values.css";

/** 핵심 가치 3가지 + 마무리 띠 */
export function ValuesSection({ content }: { content: ValuesContent }) {
  return (
    <Section id="value" className="closing">
      <Container>
        <Pill modifiers={["sm"]}>{content.eyebrow}</Pill>
        <h2 className="closing__title">
          <Lines lines={content.title} />
        </h2>
        <p className="sec-desc">
          <Lines lines={content.description} />
        </p>
        <ul className="values">
          {content.items.map((item, i) => (
            <li key={item.title}>
              <Pill modifiers={["tint", "num"]}>{String(i + 1).padStart(2, "0")}</Pill>
              <strong>{item.title}</strong>
              <p>
                <Lines lines={item.description} />
              </p>
              <OrbMark />
            </li>
          ))}
        </ul>
        <div className="final-band block-narrow">
          <div>
            <span>{content.band.eyebrow}</span>
            <strong>{content.band.message}</strong>
          </div>
          <DuoMark />
        </div>
      </Container>
    </Section>
  );
}
