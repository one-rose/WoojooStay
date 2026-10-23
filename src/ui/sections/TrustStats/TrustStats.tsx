import type { TrustStatsContent } from "@/core";
import { Container } from "../../components";
import { CountUp } from "./CountUp";
import "./trust-stats.css";

/** 신뢰 지표 (가맹점 수 등) — 첫 칸이 강조 카드 */
export function TrustStats({ content }: { content: TrustStatsContent }) {
  return (
    <section className="trust" aria-label={content.label}>
      <Container>
        <ul className="trust__list">
          {content.items.map((item, i) => (
            <li key={item.label} className={i === 0 ? "is-main" : undefined}>
              <strong>
                <CountUp to={item.value} className="trust__num" />
                <em>{item.unit}</em>
              </strong>
              <span className="trust__label">{item.label}</span>
              <span className="trust__desc">{item.description}</span>
            </li>
          ))}
        </ul>
        <p className="trust__note">{content.note}</p>
      </Container>
    </section>
  );
}
