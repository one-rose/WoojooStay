import type { HeroContent, HeroKpi } from "@/core";
import { formatNumber } from "@/shared";
import { OrbMark } from "../../brand";
import { Button, KpiCard, Lines, Pill, WonSign } from "../../components";
import { ChannelIcon } from "../../media";
import styles from "./HeroDashboard.module.css";

/** 채널 그래프에서 가장 큰 값이 차지하는 막대 높이(px) */
const BAR_MAX_HEIGHT = 135;

function KpiValue({ value }: { value: HeroKpi["value"] }) {
  if ("amount" in value) {
    return (
      <>
        <WonSign />
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

/** 히어로 오른쪽의 서비스 미리보기 카드 */
export function HeroDashboard({ content }: { content: HeroContent["dashboard"] }) {
  const maxValue = Math.max(...content.channelChart.channels.map((c) => c.value));

  return (
    <div className={styles.dashboard}>
      <div className={styles.card}>
        <div className={styles.top}>
          <strong className={styles.brand}>{content.brand}</strong>
          <Pill variant="soft">{content.liveLabel}</Pill>
        </div>

        <div className={styles.kpis}>
          {content.kpis.map((kpi) => (
            <KpiCard
              key={kpi.label}
              label={kpi.label}
              value={<KpiValue value={kpi.value} />}
              note={kpi.note}
              noteTone={kpi.noteTone}
            />
          ))}
        </div>

        <div className={styles.body}>
          <div className={styles.chart}>
            <strong className={styles.chartTitle}>{content.channelChart.title}</strong>
            <div className={styles.plot}>
              {content.channelChart.channels.map((item, i) => (
                <div className={styles.column} key={`${item.channel}-${i}`}>
                  <span
                    className={styles.bar}
                    style={{ height: Math.round((item.value / maxValue) * BAR_MAX_HEIGHT) }}
                  />
                  <ChannelIcon channel={item.channel} className={styles.channelIcon} />
                </div>
              ))}
            </div>
          </div>

          <div className={styles.aiCard}>
            <div className={styles.aiTitle}>
              <OrbMark className={styles.aiMark} /> {content.aiReview.title}
            </div>
            <p className={styles.quote}>
              <Lines lines={content.aiReview.quote} />
            </p>
            <div className={styles.reply}>
              <span>{content.aiReview.replyLabel}</span>
              <p>
                <Lines lines={content.aiReview.reply} />
              </p>
            </div>
            <Button size="xs" className={styles.aiAction}>
              {content.aiReview.action}
            </Button>
          </div>
        </div>
      </div>

      <div className={`${styles.floating} ${styles.current}`}>
        <span>{content.currentStep.eyebrow}</span>
        <strong>{content.currentStep.title}</strong>
      </div>
      <div className={`${styles.floating} ${styles.next}`}>
        <span>{content.nextStep.eyebrow}</span>
        <strong>{content.nextStep.title}</strong>
      </div>
    </div>
  );
}
