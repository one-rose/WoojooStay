import type { OperationsContent } from "@/core";
import { Container, Section, SectionIntro } from "../../components";
import { ExpenseCard } from "./ExpenseCard";
import { StaffingCard } from "./StaffingCard";
import styles from "./OperationsSection.module.css";

/** SERVICE 04 — 알바관리 · 지출관리 */
export function OperationsSection({ content }: { content: OperationsContent }) {
  return (
    <Section tone="alt" className={styles.section}>
      <Container>
        <SectionIntro intro={content.intro} />
        <div className={styles.cards}>
          <StaffingCard content={content.staffing} brandPrefix={content.brandPrefix} />
          <ExpenseCard content={content.expenses} brandPrefix={content.brandPrefix} />
        </div>
      </Container>
    </Section>
  );
}
