import type { OperationsContent } from "@/core";
import { Container, Section, SectionHead } from "../../components";
import { ExpenseCard } from "./ExpenseCard";
import { StaffingCard } from "./StaffingCard";
import "./operations.css";

/** SERVICE 04 — 알바관리 · 지출관리 */
export function OperationsSection({ content }: { content: OperationsContent }) {
  return (
    <Section tone="alt" className="section--s4">
      <Container>
        <SectionHead intro={content.intro} />
        <div className="ops-grid block-narrow">
          <StaffingCard content={content.staffing} brandPrefix={content.brandPrefix} />
          <ExpenseCard content={content.expenses} brandPrefix={content.brandPrefix} />
        </div>
      </Container>
    </Section>
  );
}
