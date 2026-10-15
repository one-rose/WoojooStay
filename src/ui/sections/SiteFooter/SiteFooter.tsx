import type { SiteFooterContent } from "@/core";
import { DuoMark, Logo } from "../../brand";
import { Button, Container } from "../../components";
import styles from "./SiteFooter.module.css";

export function SiteFooter({ content }: { content: SiteFooterContent }) {
  return (
    <footer className={styles.footer} id="partner">
      <Container>
        <div className={styles.top}>
          <div>
            <Logo tone="footer" />
            <p className={styles.descriptor}>{content.descriptor}</p>
          </div>
          <Button href={content.cta.href} size="xl">
            <DuoMark className={styles.duo} /> {content.cta.label}
          </Button>
        </div>
        <p className={styles.tagline}>
          {content.slogan} <br />
          <b>{content.keywords.join(" · ")}</b>
        </p>
        <p className={styles.copyright}>{content.copyright}</p>
      </Container>
    </footer>
  );
}
