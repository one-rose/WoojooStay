import type { SiteHeaderContent } from "@/core";
import { Logo } from "../../brand";
import { Button, Container } from "../../components";
import styles from "./SiteHeader.module.css";

export function SiteHeader({ content }: { content: SiteHeaderContent }) {
  return (
    <header className={styles.header}>
      <Container className={styles.inner}>
        <a href="#top" className={styles.logo} aria-label="우주스테이 홈">
          <Logo />
        </a>
        <nav className={styles.nav} aria-label="주요 메뉴">
          {content.nav.map((link) => (
            <a key={link.href + link.label} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <Button href={content.cta.href} size="sm">
          {content.cta.label}
        </Button>
      </Container>
    </header>
  );
}
