import type { Locale, SiteHeaderContent } from "@/core";
import { Logo } from "../../brand";
import { Button, Container } from "../../components";
import { LanguageSwitcher } from "./LanguageSwitcher";
import "./site-header.css";

export function SiteHeader({ content, locale }: { content: SiteHeaderContent; locale: Locale }) {
  return (
    <header className="header">
      <Container className="header__inner">
        <a href="#top" className="header__logo">
          <Logo />
        </a>
        <nav className="header__nav" aria-label={content.navLabel}>
          {content.nav.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <LanguageSwitcher current={locale} />
        <Button href={content.cta.href} size="sm">
          {content.cta.label}
        </Button>
      </Container>
    </header>
  );
}
