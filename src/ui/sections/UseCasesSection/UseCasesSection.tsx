import type { UseCasesContent } from "@/core";
import { Container, Pill, Section } from "../../components";
import { UseCaseTabs } from "./UseCaseTabs";
import "./use-cases.css";

/** 숙박 유형별 활용 (호텔 · 모텔 · 펜션 · 게스트하우스) */
export function UseCasesSection({ content }: { content: UseCasesContent }) {
  return (
    <Section id="cases" className="cases">
      <Container>
        <Pill modifiers={["lg"]}>{content.eyebrow}</Pill>
        <h2 className="sec-title">{content.title}</h2>
        <p className="sec-desc">{content.description}</p>
        <UseCaseTabs content={content} />
      </Container>
    </Section>
  );
}
