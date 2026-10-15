import type { SectionIntro as SectionIntroContent } from "@/core";
import { cx } from "@/shared";
import { Illustration } from "../../media";
import { Lines } from "../Lines/Lines";
import { Pill } from "../Pill/Pill";
import styles from "./SectionIntro.module.css";

interface SectionIntroProps {
  intro: SectionIntroContent;
  /** 시안에서 제목이 이름표에 바짝 붙는 섹션(SERVICE 01·02) */
  compact?: boolean;
  /** 오른쪽 일러스트 없이 글만 쓸 때 */
  className?: string;
}

/** 서비스 섹션 머리: 이름표 + 제목 + 설명 (+ 오른쪽 일러스트) */
export function SectionIntro({ intro, compact = false, className }: SectionIntroProps) {
  return (
    <div className={cx(styles.intro, compact && styles.compact, className)}>
      <div className={styles.copy}>
        <Pill>{intro.eyebrow}</Pill>
        <h2 className={styles.title}>
          <Lines lines={intro.title} />
        </h2>
        <p className={styles.description}>
          <Lines lines={intro.description} collapseOnTablet />
        </p>
      </div>
      {intro.illustration && <Illustration id={intro.illustration} className={styles.illustration} />}
    </div>
  );
}
