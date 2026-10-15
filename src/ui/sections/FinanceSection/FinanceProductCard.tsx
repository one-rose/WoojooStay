import { Fragment } from "react";
import type { FinanceProduct } from "@/core";
import { cx, formatNumber } from "@/shared";
import { OrbMark } from "../../brand";
import { Lines, WonSign } from "../../components";
import styles from "./FinanceProductCard.module.css";

interface FinanceProductCardProps {
  product: FinanceProduct;
  brandPrefix: string;
  flowCaption: string;
  /** DATA → FINANCE → CASH (마지막 단계가 강조됨) */
  flow: readonly string[];
}

export function FinanceProductCard({ product, brandPrefix, flowCaption, flow }: FinanceProductCardProps) {
  return (
    <article className={styles.card}>
      <OrbMark className={styles.mark} />
      <h3 className={styles.name}>
        <span>{brandPrefix}</span> {product.name}
      </h3>
      <p className={styles.description}>
        <Lines lines={product.description} collapseOnTablet />
      </p>
      <div className={styles.metric}>
        <span>{product.metricLabel}</span>
        <strong>
          <WonSign className={styles.won} />
          {formatNumber(product.amount)}
        </strong>
      </div>
      <p className={styles.caption}>{flowCaption}</p>
      <div className={styles.flow}>
        {flow.map((step, i) => (
          <Fragment key={step}>
            {i > 0 && <span className={styles.arrow} aria-hidden="true" />}
            <span className={cx(styles.step, i === flow.length - 1 && styles.stepActive)}>{step}</span>
          </Fragment>
        ))}
      </div>
    </article>
  );
}
