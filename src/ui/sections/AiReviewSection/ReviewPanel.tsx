import type { AiReviewContent } from "@/core";
import { DuoMark, OrbMark } from "../../brand";
import { Arrow, PanelTop, Pill, Tabs } from "../../components";
import { Illustration, PlatformLogo, ReviewPhoto } from "../../media";

const stars = (rating: number) => "★".repeat(rating) + "☆".repeat(5 - rating);

interface ReviewPanelProps {
  panel: AiReviewContent["panel"];
  callout: AiReviewContent["callout"];
}

/** 오른쪽: 리뷰 관리 화면 목업 + 아래 고객 획득 포인트 띠 */
export function ReviewPanel({ panel, callout }: ReviewPanelProps) {
  return (
    <div className="rv-panel">
      <div className="rv-panel__inner">
        <PanelTop title={panel.title} aside={<Pill modifiers={["tint"]}>{panel.status}</Pill>} />
        <Tabs tabs={panel.tabs} />
        <ul className="rv-list">
          {panel.reviews.map((review) => (
            <li key={review.platform}>
              <div className="rv-list__meta">
                <span className="rv-list__tag">{review.tag}</span>
                <span className="rv-list__stars" aria-label={panel.ratingLabel}>
                  {stars(review.rating)}
                </span>
                <PlatformLogo platform={review.platform} variant="review" alt="" />
              </div>
              <p className="rv-list__text">{review.text}</p>
              <div className="rv-list__photos">
                <ReviewPhoto photo={review.photos[0]} alt={`${review.tag} ${panel.photoAlt}`} />
                <span className="rv-list__more">
                  <ReviewPhoto photo={review.photos[1]} alt="" />
                  <b>+{review.morePhotos}</b>
                </span>
              </div>
              <p className="rv-list__note">
                <OrbMark />
                <b>AI</b> {review.aiNote}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rv-cta">
        <Illustration id={callout.robot} className="rv-cta__robot" alt={callout.robotAlt} />
        <div>
          <span>{callout.eyebrow}</span>
          <strong>
            {callout.flow[0]} <Arrow /> {callout.flow[1]}
          </strong>
        </div>
        <DuoMark />
      </div>
    </div>
  );
}
