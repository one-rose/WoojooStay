import type { LedgerContent } from "@/core";
import { formatNumber } from "@/shared";
import { OrbMark } from "../../brand";
import { Container, KpiCard, KpiRow, PanelTop, Pill, Section, SectionHead, Won } from "../../components";
import { TrendChart } from "./TrendChart";
import "./ledger.css";

/** SERVICE 02 — 디지털매출장부 */
export function LedgerSection({ content }: { content: LedgerContent }) {
  const { dashboard } = content;
  return (
    <Section tone="alt">
      <Container>
        <SectionHead intro={content.intro} tight />

        <div className="ledger">
          <PanelTop
            title={dashboard.title}
            aside={<Pill modifiers={["tint", "date"]}>{dashboard.period}</Pill>}
            plain
          />
          <KpiRow columns={4}>
            {dashboard.kpis.map((kpi) => (
              <KpiCard
                key={kpi.label}
                size="lg"
                label={kpi.label}
                value={
                  <>
                    <Won />
                    {formatNumber(kpi.amount)}
                  </>
                }
                note={kpi.note}
                noteTone="accent"
              />
            ))}
          </KpiRow>
          <div className="ledger__body">
            <TrendChart title={dashboard.trend.title} axis={dashboard.trend.axis} />
            <div className="ledger__side">
              <div className="settle">
                <span>{dashboard.settlement.label}</span>
                <div>
                  <strong>
                    <Won />
                    {formatNumber(dashboard.settlement.amount)}
                  </strong>
                  <em>{dashboard.settlement.note}</em>
                </div>
              </div>
              <div className="adeff">
                <span>{dashboard.adEfficiency.label}</span>
                <p>{dashboard.adEfficiency.caption}</p>
                <strong>
                  {dashboard.adEfficiency.ratio}
                  <small>%</small>
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className="bridge">
          <strong>{content.bridge}</strong>
          <span className="bridge__line" aria-hidden="true" />
          <OrbMark className="bridge__orb" />
        </div>
      </Container>
    </Section>
  );
}
