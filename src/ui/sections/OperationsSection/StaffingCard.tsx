import type { OperationsContent } from "@/core";
import { formatMillions } from "@/shared";
import { OperationCard } from "./OperationCard";
import styles from "./StaffingCard.module.css";

interface StaffingCardProps {
  content: OperationsContent["staffing"];
  brandPrefix: string;
}

export function StaffingCard({ content, brandPrefix }: StaffingCardProps) {
  return (
    <OperationCard
      tone="neutral"
      brandPrefix={brandPrefix}
      name={content.name}
      description={content.description}
      panelTitle={content.panelTitle}
    >
      <ul className={styles.staff}>
        {content.staff.map((member) => (
          <li key={member.name}>
            <span className={styles.avatar} aria-hidden="true">
              {member.name.charAt(0)}
            </span>
            <span className={styles.person}>
              <b>{member.name}</b>
              <small>{member.role}</small>
            </span>
            <span className={styles.line} aria-hidden="true" />
            <span className={styles.number}>{member.hours}h</span>
            <span className={styles.number}>₩{formatMillions(member.pay)}</span>
          </li>
        ))}
      </ul>
    </OperationCard>
  );
}
