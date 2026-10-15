import type { RoadmapContent } from "@/core";
import { ArrowFlow } from "../../components";
import { Illustration } from "../../media";
import styles from "./GrowthLogic.module.css";

/** 로드맵 하단 — 가입 → 데이터 → 금융 → 운영 → 재방문 */
export function GrowthLogic({ content }: { content: RoadmapContent["growth"] }) {
  return (
    <div className={styles.growth}>
      <span className={styles.label}>{content.label}</span>
      <strong className={styles.text}>
        <ArrowFlow parts={content.flow} />
      </strong>
      <ol className={styles.flow}>
        {content.nodes.map((node) => (
          <li key={node.label}>
            <span className={styles.node}>
              <Illustration id={node.illustration} height={70} className={styles.illustration} />
              <em>{node.label}</em>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
