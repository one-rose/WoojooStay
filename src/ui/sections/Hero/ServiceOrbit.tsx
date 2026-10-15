import type { CSSProperties } from "react";
import type { OrbitItem } from "@/core";
import { OrbMark } from "../../brand";
import { Illustration } from "../../media";
import styles from "./ServiceOrbit.module.css";

/** 궤도 위 아이템 자리 (중심 기준 px). 순서대로 콘텐츠의 orbit 항목이 놓인다 */
const SLOTS = [
  { x: -40, y: -154 },
  { x: -126, y: -81 },
  { x: -143, y: 22 },
  { x: -84, y: 109 },
  { x: 40, y: 134 },
] as const;

/** 히어로의 "서비스 궤도" 그림: 가운데 O 마크와 주변 서비스 아이콘 */
export function ServiceOrbit({ items }: { items: readonly OrbitItem[] }) {
  return (
    <div className={styles.slot}>
      <div className={styles.orbit} aria-label="우주스테이 서비스 구성">
        <i className={styles.ringInner} />
        <i className={styles.ringOuter} />
        <OrbMark className={styles.core} />
        {items.slice(0, SLOTS.length).map((item, i) => (
          <div
            key={item.title}
            className={styles.item}
            style={{ "--x": `${SLOTS[i].x}px`, "--y": `${SLOTS[i].y}px` } as CSSProperties}
          >
            <Illustration id={item.illustration} height={54} className={styles.icon} />
            <strong>{item.title}</strong>
            <span>{item.caption}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
