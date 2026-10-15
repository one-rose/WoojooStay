import type { LedgerContent } from "@/core";
import { formatNumber } from "@/shared";
import { OrbMark } from "../../brand";
import { Container, KpiCard, PanelHeader, Pill, Section, SectionIntro, WonSign } from "../../components";
import { TrendChart } from "./TrendChart";
import styles from "./LedgerSection.module.css";

/** SERVICE 02 — 디지털매출장부 */
export function LedgerSection({ content }: { content: LedgerContent }) {
  const { dashboard } = content;
  return (
    <Section tone="alt" className={styles.section}>
      <Container>
        <SectionIntro intro={content.intro} compact />

        <div className={styles.dashboard}>
          <PanelHeader title={dashboard.title} plain aside={<Pill variant="date">{dashboard.period}</Pill>} />
          <div className={styles.kpis}>
            {dashboard.kpis.map((kpi) => (
              <KpiCard
                key={kpi.label}
                size="lg"
                label={kpi.label}
                value={
                  <>
                    <WonSign />
                    {formatNumber(kpi.amount)}
                  </>
                }
                note={kpi.note}
                noteTone="accent"
              />
            ))}
          </div>

          <div className={styles.body}>
            <TrendChart title={dashboard.trendTitle} />
            <div className={styles.side}>
              <div className={styles.settlement}>
                <span>{dashboard.settlement.label}</span>
                <div>
                  <strong>
                    <WonSign />
                    {formatNumber(dashboard.settlement.amount)}
                  </strong>
                  <em>{dashboard.settlement.note}</em>
                </div>
              </div>
              <div className={styles.efficiency}>
                <span>{dashboard.adEfficiency.label}</span>
                <p>{dashboard.adEfficiency.caption}</p>
                <strong>
                  {dashboard.adEfficiency.ratio} <small>X</small>
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.bridge}>
          <strong>{content.bridge}</strong>
          <span className={styles.bridgeLine} aria-hidden="true" />
          <OrbMark className={styles.bridgeMark} />
        </div>
      </Container>
    </Section>
  );
}
