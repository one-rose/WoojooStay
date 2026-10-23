import type { OperationsContent } from "@/core";
import { formatMillions } from "@/shared";
import { OrbMark } from "../../brand";
import { Lines, Won } from "../../components";

/** 가장 큰 지출 막대가 차지하는 길이(%) */
const LARGEST_BAR_PERCENT = 74;

interface ExpenseCardProps {
  content: OperationsContent["expenses"];
  brandPrefix: string;
}

/** 지출관리 카드 */
export function ExpenseCard({ content, brandPrefix }: ExpenseCardProps) {
  const max = Math.max(...content.items.map((item) => item.amount));
  return (
    <article className="ops-card ops-card--exp">
      <OrbMark className="ops-card__orb" />
      <h3>
        <span>{brandPrefix}</span> {content.name}
      </h3>
      <p>
        <Lines lines={content.description} />
      </p>
      <div className="ops-panel">
        <strong>{content.panelTitle}</strong>
        <ul className="expense">
          {content.items.map((item) => (
            <li key={item.label}>
              <span className="expense__label">{item.label}</span>
              <span className="expense__track">
                <i style={{ width: `${Math.round((item.amount / max) * LARGEST_BAR_PERCENT)}%` }} />
              </span>
              <span className="expense__amt">
                <Won /> {formatMillions(item.amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
