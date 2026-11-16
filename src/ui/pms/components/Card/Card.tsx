import type { ReactNode } from "react";
import { cx } from "@/shared";
import "./card.css";

interface CardProps {
  title?: ReactNode;
  /** 오른쪽에 붙는 값 하나 (합계, 기간 등). 가운뎃점으로 여러 개를 잇지 않는다 */
  meta?: ReactNode;
  action?: ReactNode;
  /** flush: 안쪽 여백 없음 (표·목록을 꽉 채울 때) */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({ title, meta, action, flush, className, children }: CardProps) {
  return (
    <section className={cx("pm-card", flush && "pm-card--flush", className)}>
      {(title || action) && (
        <header className="pm-card__head">
          {title && <h2 className="pm-card__title">{title}</h2>}
          {(meta || action) && (
            <div className="pm-card__side">
              {meta && <span className="pm-card__meta">{meta}</span>}
              {action}
            </div>
          )}
        </header>
      )}
      <div className="pm-card__body">{children}</div>
    </section>
  );
}
