import type { HeroContent } from "@/core";
import { Button, Container, Lines, Pill } from "../../components";
import { HeroDashboard } from "./HeroDashboard";
import { ServiceOrbit } from "./ServiceOrbit";
import styles from "./Hero.module.css";

export function Hero({ content }: { content: HeroContent }) {
  return (
    <section className={styles.hero} id="top">
      <div className={styles.rings} aria-hidden="true">
        <i />
        <i />
      </div>
      <Container className={styles.inner}>
        <div className={styles.copy}>
          <Pill>{content.badge}</Pill>
          <h1 className={styles.title}>
            <Lines lines={content.title} />
          </h1>
          <p className={styles.lead}>
            <Lines lines={content.lead} collapseOnTablet />
          </p>
          <ServiceOrbit items={content.orbit} />
          <div className={styles.actions}>
            <Button href={content.primaryCta.href} className={styles.action}>
              {content.primaryCta.label}
            </Button>
            <Button href={content.secondaryCta.href} variant="ghost" className={styles.action}>
              {content.secondaryCta.label}
            </Button>
          </div>
        </div>
        <HeroDashboard content={content.dashboard} />
      </Container>
    </section>
  );
}
