import type { FinanceProduct } from "@/core";
import { formatNumber } from "@/shared";
import { OrbMark } from "../../brand";
import { Lines, Won } from "../../components";

interface FinanceProductCardProps {
  product: FinanceProduct;
  brandPrefix: string;
  flowCaption: string;
  flow: readonly string[];
}

/** 매출선정산 · 미래매출선지급 카드 */
export function FinanceProductCard({ product, brandPrefix, flowCaption, flow }: FinanceProductCardProps) {
  return (
    <article className="fin-card">
      <OrbMark className="fin-card__orb" />
      <h3>
        <span>{brandPrefix}</span> {product.name}
      </h3>
      <p className="fin-card__desc">
        <Lines lines={product.description} />
      </p>
      <div className="fin-card__box">
        <span>{product.metricLabel}</span>
        <strong>
          <Won />
          {formatNumber(product.amount)}
        </strong>
      </div>
      <p className="fin-card__cap">{flowCaption}</p>
      <div className="flow">
        {flow.map((step, i) => (
          <FlowStep key={step} label={step} first={i === 0} last={i === flow.length - 1} />
        ))}
      </div>
    </article>
  );
}

function FlowStep({ label, first, last }: { label: string; first: boolean; last: boolean }) {
  return (
    <>
      {!first && <span className="flow__arrow" />}
      <span className={last ? "flow__step flow__step--on" : "flow__step"}>{label}</span>
    </>
  );
}
