import type { CSSProperties } from "react";
import type { OrbitItem } from "@/core";
import { OrbMark } from "../../brand";
import { Illustration } from "../../media";

/** 궤도 위 서비스 5개의 자리 (중심 기준 px) — 순서는 콘텐츠의 orbit 배열 순서 */
const SLOTS = [
  { x: 0, y: -140 },
  { x: 112, y: -36 },
  { x: 89, y: 123 },
  { x: -75, y: 104 },
  { x: -138, y: -45 },
] as const;

/** 궤도 링 — CSS 의 orbit__ring--N 과 1:1 */
const RINGS = [3, 4, 5, 0, 1, 2] as const;

/** 궤도를 도는 작은 위성 점들 (r: 궤도 반지름, s: 크기, d: 한 바퀴 시간) */
const SATELLITES = [
  { r: "430px", s: "4px", c: "var(--primary)", o: ".55", d: "36s", delay: "-27s", dir: "reverse" },
  { r: "300px", s: "7px", c: "var(--primary)", o: ".5", d: "40s", delay: "-30s", dir: "normal" },
  { r: "430px", s: "9px", c: "var(--accent)", o: ".6", d: "48s", delay: "-16s", dir: "normal" },
  { r: "430px", s: "6px", c: "var(--primary)", o: ".4", d: "64s", delay: "-40s", dir: "normal" },
  { r: "300px", s: "11px", c: "var(--accent)", o: ".35", d: "26s", delay: "-13s", dir: "reverse" },
] as const;

export function ServiceOrbit({ label, items }: { label: string; items: readonly OrbitItem[] }) {
  return (
    <div className="orbit-slot">
      <div className="orbit" aria-label={label}>
        {RINGS.map((n) => (
          <i key={n} className={`orbit__ring orbit__ring--${n}`} />
        ))}
        {SATELLITES.map((sat, i) => (
          <i
            key={i}
            className="orbit__sat"
            style={
              {
                "--r": sat.r,
                "--s": sat.s,
                "--c": sat.c,
                "--o": sat.o,
                "--d": sat.d,
                "--delay": sat.delay,
                "--dir": sat.dir,
              } as CSSProperties
            }
          />
        ))}
        <OrbMark className="orbit__core" />
        {items.map((item, i) => (
          <div
            key={item.title}
            className="orbit__item"
            style={{ "--x": `${SLOTS[i].x}px`, "--y": `${SLOTS[i].y}px` } as CSSProperties}
          >
            <Illustration id={item.illustration} />
            <strong>{item.title}</strong>
            <span>{item.caption}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
