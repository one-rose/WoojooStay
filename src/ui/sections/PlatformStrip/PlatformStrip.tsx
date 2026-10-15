import type { PlatformStripContent } from "@/core";
import { Container } from "../../components";
import { PlatformLogo } from "../../media";
import styles from "./PlatformStrip.module.css";

/** 히어로 아래 "4대 예약 플랫폼" 로고 띠 */
export function PlatformStrip({ content }: { content: PlatformStripContent }) {
  return (
    <section className={styles.strip} aria-label="연동 예약 플랫폼">
      <Container className={styles.inner}>
        <p className={styles.lead}>
          {content.lead.before}
          <b>{content.lead.emphasis}</b>
          {content.lead.after}
        </p>
        <ul className={styles.list}>
          {content.platforms.map((platform) => (
            <li key={platform}>
              <PlatformLogo platform={platform} variant="chip" />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
