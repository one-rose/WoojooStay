import type { HeroContent, PlatformId } from "@/core";
import { Button, Container, Lines, Pill } from "../../components";
import { HeroDashboard } from "./HeroDashboard";
import { ServiceOrbit } from "./ServiceOrbit";
import "./hero.css";

interface HeroProps {
  content: HeroContent;
  platformNames: Readonly<Record<PlatformId, string>>;
}

export function Hero({ content, platformNames }: HeroProps) {
  return (
    <section className="hero" id="top">
      <div className="hero__rings" aria-hidden="true">
        <i />
        <i />
      </div>
      <Container className="hero__inner">
        <div className="hero__copy">
          <Pill modifiers={["lg"]}>{content.badge}</Pill>
          <h1 className="hero__title">
            <Lines lines={content.title} />
          </h1>
          <p className="hero__lead">
            <Lines lines={content.lead} />
          </p>
          <ServiceOrbit label={content.orbitLabel} items={content.orbit} />
          <div className="hero__cta">
            <Button href={content.primaryCta.href}>{content.primaryCta.label}</Button>
            <Button href={content.secondaryCta.href} variant="ghost">
              {content.secondaryCta.label}
            </Button>
          </div>
        </div>
        <HeroDashboard content={content.dashboard} platformNames={platformNames} />
      </Container>
    </section>
  );
}
