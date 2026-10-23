import type { OperationsContent } from "@/core";
import { formatMillions } from "@/shared";
import { OrbMark } from "../../brand";
import { Lines } from "../../components";

interface StaffingCardProps {
  content: OperationsContent["staffing"];
  brandPrefix: string;
}

/** 알바관리 카드 */
export function StaffingCard({ content, brandPrefix }: StaffingCardProps) {
  return (
    <article className="ops-card ops-card--hr">
      <OrbMark className="ops-card__orb" />
      <h3>
        <span>{brandPrefix}</span> {content.name}
      </h3>
      <p>
        <Lines lines={content.description} />
      </p>
      <div className="ops-panel">
        <strong>{content.panelTitle}</strong>
        <ul className="staff">
          {content.staff.map((member) => (
            <li key={member.name}>
              <span className="staff__avatar">{member.initial}</span>
              <span className="staff__name">
                <b>{member.name}</b>
                <small>{member.role}</small>
              </span>
              <span className="staff__line" />
              <span className="staff__num">{member.hours}h</span>
              <span className="staff__num">₩{formatMillions(member.pay)}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
