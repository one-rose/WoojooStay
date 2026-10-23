import type { SectionIntro } from "@/core";
import { cx } from "@/shared";
import { Illustration } from "../../media";
import { Lines } from "../Lines/Lines";
import { Pill } from "../Pill/Pill";
import "./section.css";

interface SectionHeadProps {
  intro: SectionIntro;
  /** 제목이 이름표에 바짝 붙는 형태 (SERVICE 02) */
  tight?: boolean;
}

/** 서비스 섹션 머리말: 이름표 + 제목 + 설명 + 오른쪽 일러스트 */
export function SectionHead({ intro, tight = false }: SectionHeadProps) {
  return (
    <div className={cx("sec-head", tight && "sec-head--tight")}>
      <div className="sec-head__copy">
        <Pill modifiers={["lg"]}>{intro.eyebrow}</Pill>
        <h2 className={cx("sec-title", tight && "sec-title--tight")}>
          <Lines lines={intro.title} />
        </h2>
        <p className="sec-desc">
          <Lines lines={intro.description} />
        </p>
      </div>
      {intro.illustration && <Illustration id={intro.illustration} className="sec-head__illust" />}
    </div>
  );
}
