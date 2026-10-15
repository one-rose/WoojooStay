import type { OperationsContent } from "@/core";
import { formatMillions } from "@/shared";
import { OperationCard } from "./OperationCard";
import styles from "./ExpenseCard.module.css";

/** 막대 길이 기준: 가장 큰 항목이 약 74% 를 차지하도록 */
const SCALE_HEADROOM = 1.35;

interface ExpenseCardProps {
  content: OperationsContent["expenses"];
  brandPrefix: string;
}

export function ExpenseCard({ content, brandPrefix }: ExpenseCardProps) {
  const scale = Math.max(...content.items.map((item) => item.amount)) * SCALE_HEADROOM;
  return (
    <OperationCard
      tone="highlight"
      brandPrefix={brandPrefix}
      name={content.name}
      description={content.description}
      panelTitle={content.panelTitle}
    >
      <ul className={styles.expenses}>
        {content.items.map((item) => (
          <li key={item.label}>
            <span className={styles.label}>{item.label}</span>
            <span className={styles.track} aria-hidden="true">
              <i style={{ width: `${(item.amount / scale) * 100}%` }} />
            </span>
            <span className={styles.amount}>
              <span className={styles.won}>₩</span> {formatMillions(item.amount)}
            </span>
          </li>
        ))}
      </ul>
    </OperationCard>
  );
}
