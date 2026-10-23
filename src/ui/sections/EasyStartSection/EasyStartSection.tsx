import type { EasyStartContent } from "@/core";
import { Button, Container, Pill, Section } from "../../components";
import "./easy-start.css";

/** 도입 안내 4단계 + 상담 버튼 */
export function EasyStartSection({ content }: { content: EasyStartContent }) {
  return (
    <Section className="easy">
      <Container>
        <Pill modifiers={["lg"]}>{content.eyebrow}</Pill>
        <h2 className="sec-title">{content.title}</h2>
        <ul className="easy__list">
          {content.steps.map((step, i) => (
            <li key={step.title}>
              <span className="easy__no">{String(i + 1).padStart(2, "0")}</span>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </li>
          ))}
        </ul>
        <div className="easy__cta">
          <Button href={content.primaryCta.href}>{content.primaryCta.label}</Button>
          <Button href={content.secondaryCta.href} variant="ghost">
            {content.secondaryCta.label}
          </Button>
        </div>
      </Container>
    </Section>
  );
}
