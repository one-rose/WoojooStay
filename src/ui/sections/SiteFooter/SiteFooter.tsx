import type { SiteFooterContent } from "@/core";
import { DuoMark, Logo } from "../../brand";
import { Button, Container } from "../../components";
import "./site-footer.css";

export function SiteFooter({ content }: { content: SiteFooterContent }) {
  return (
    <footer className="footer" id="partner">
      <Container>
        <div className="footer__top block-narrow">
          <div>
            <Logo tone="footer" />
            <p className="footer__os">{content.descriptor}</p>
          </div>
          <Button href={content.cta.href} size="xl">
            <DuoMark /> {content.cta.label}
          </Button>
        </div>
        <p className="footer__tag">
          {content.slogan}
          <br />
          <b>{content.keywords}</b>
        </p>
        <p className="footer__copy">{content.copyright}</p>
      </Container>
    </footer>
  );
}
