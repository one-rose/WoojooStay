import type { PlatformStripContent } from "@/core";
import { Container } from "../../components";
import { PlatformLogo } from "../../media";
import "./platform-strip.css";

/** 연동 숙박 예약 플랫폼 로고 띠 */
export function PlatformStrip({ content }: { content: PlatformStripContent }) {
  const { lead } = content;
  return (
    <section className="platforms">
      <Container className="platforms__inner">
        <p className="platforms__text">
          {lead.before}
          <b>{lead.emphasis}</b>
          {lead.after}
        </p>
        <ul className="platforms__list">
          {content.platforms.map((item) => (
            <li key={item.platform}>
              <PlatformLogo platform={item.platform} variant="strip" alt={item.label} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
