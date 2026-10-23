import type { HeroContent, HeroKpi, PlatformId } from "@/core";
import { formatNumber } from "@/shared";
import { OrbMark } from "../../brand";
import { Button, KpiCard, KpiRow, Lines, Pill, Won } from "../../components";
import { ChannelIcon } from "../../media";
import "./hero-dashboard.css";

/** 가장 큰 막대의 높이(px) */
const BAR_MAX_HEIGHT = 104;

function KpiValue({ value }: { value: HeroKpi["value"] }) {
  if ("amount" in value) {
    return (
      <>
        <Won />
        {formatNumber(value.amount)}
      </>
    );
  }
  return (
    <>
      {value.count}
      <small>{value.unit}</small>
    </>
  );
}

interface HeroDashboardProps {
  content: HeroContent["dashboard"];
  platformNames: Readonly<Record<PlatformId, string>>;
}

/** 히어로 오른쪽 대시보드 목업 */
export function HeroDashboard({ content, platformNames }: HeroDashboardProps) {
  const { channels } = content.channelChart;
  const max = Math.max(...channels.map((c) => c.value));
  return (
    <div className="hero-dash">
      <div className="hero-dash__card">
        <div className="hero-dash__top">
          <strong className="hero-dash__brand">{content.brand}</strong>
          <Pill modifiers={["soft"]}>{content.liveLabel}</Pill>
        </div>

        <KpiRow columns={3}>
          {content.kpis.map((kpi) => (
            <KpiCard
              key={kpi.label}
              label={kpi.label}
              value={<KpiValue value={kpi.value} />}
              note={kpi.note}
              noteTone={kpi.noteTone}
            />
          ))}
        </KpiRow>

        <div className="hero-dash__body">
          <div className="bars">
            <strong className="bars__title">{content.channelChart.title}</strong>
            <div className="bars__plot">
              {channels.map((channel) => (
                <div className="bars__col" key={channel.platform}>
                  <span className="bars__bar" style={{ height: Math.round((channel.value / max) * BAR_MAX_HEIGHT) }} />
                  <ChannelIcon
                    platform={channel.platform}
                    alt={platformNames[channel.platform]}
                    className="bars__icon"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="ai-card">
            <div className="ai-card__title">
              <OrbMark /> {content.aiReview.title}
            </div>
            <p className="ai-card__quote">
              <Lines lines={content.aiReview.quote} />
            </p>
            <div className="ai-card__reply">
              <span>{content.aiReview.replyLabel}</span>
              <p>
                <Lines lines={content.aiReview.reply} />
              </p>
            </div>
            <Button size="xs">{content.aiReview.action}</Button>
          </div>
        </div>
      </div>

      <div className="float-card float-card--step">
        <span>{content.currentStep.label}</span>
        <strong>{content.currentStep.text}</strong>
      </div>
      <div className="float-card float-card--next">
        <span>{content.nextStep.label}</span>
        <strong>{content.nextStep.text}</strong>
      </div>
    </div>
  );
}
