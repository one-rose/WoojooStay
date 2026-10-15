import type { AiReviewContent, Review } from "@/core";
import { DuoMark, OrbMark } from "../../brand";
import { ArrowFlow, PanelHeader, Pill } from "../../components";
import { Illustration, PLATFORM_NAMES, PlatformLogo } from "../../media";
import { cx } from "@/shared";
import styles from "./ReviewPanel.module.css";

function Stars({ rating }: { rating: Review["rating"] }) {
  return (
    <span className={styles.stars} aria-label={`별점 ${rating}점`}>
      {"★".repeat(rating) + "☆".repeat(5 - rating)}
    </span>
  );
}

interface ReviewPanelProps {
  panel: AiReviewContent["panel"];
  callout: AiReviewContent["callout"];
}

/** 리뷰 관리 화면 미리보기 + 아래 "고객 획득 포인트" 띠 */
export function ReviewPanel({ panel, callout }: ReviewPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.inner}>
        <PanelHeader title={panel.title} aside={<Pill variant="tint">{panel.status}</Pill>} />
        <div className={styles.tabs}>
          {panel.tabs.map((tab) => (
            <span key={tab.label} className={cx(tab.active && styles.activeTab)}>
              {tab.label} {tab.count}
            </span>
          ))}
        </div>
        <ul className={styles.reviews}>
          {panel.reviews.map((review) => (
            <li key={review.platform}>
              <div className={styles.meta}>
                <span className={styles.tag}>{PLATFORM_NAMES[review.platform]}</span>
                <Stars rating={review.rating} />
                <PlatformLogo platform={review.platform} variant="card" className={styles.platformLogo} decorative />
              </div>
              <p className={styles.text}>{review.text}</p>
              <p className={styles.note}>
                <OrbMark className={styles.noteMark} />
                <b>AI</b> {review.aiNote}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.callout}>
        <Illustration id="robot" alt={callout.mascotAlt} className={styles.mascot} />
        <div className={styles.calloutText}>
          <span>{callout.eyebrow}</span>
          <strong>
            <ArrowFlow parts={callout.flow} />
          </strong>
        </div>
        <DuoMark className={styles.calloutMark} />
      </div>
    </div>
  );
}
