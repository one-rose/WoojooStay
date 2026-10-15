import { useId, type CSSProperties } from "react";
import type { MarkPaths } from "./logo-paths";

interface Paint {
  /** 단색이면 하나, 그라데이션이면 왼쪽→오른쪽 순서의 색 (CSS 값·변수 모두 가능) */
  stops: readonly string[];
  opacity?: string;
}

interface MarkProps {
  paths: MarkPaths;
  body: Paint;
  star: Paint;
  title?: string;
  className?: string;
}

/** 로고 계열 벡터를 그리는 기본 컴포넌트. 색은 모두 CSS 값으로 받는다. */
export function Mark({ paths, body, star, title, className }: MarkProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const fillOf = (paint: Paint, key: string) => (paint.stops.length > 1 ? `url(#${id}-${key})` : paint.stops[0]);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${paths.w} ${paths.h}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        {[
          ["body", body],
          ["star", star],
        ].map(([key, paint]) =>
          (paint as Paint).stops.length > 1 ? (
            <linearGradient
              key={key as string}
              id={`${id}-${key}`}
              x1="0"
              y1="0"
              x2={paths.w}
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              {(paint as Paint).stops.map((color, i, all) => (
                <stop key={i} offset={i / (all.length - 1)} style={{ stopColor: color } as CSSProperties} />
              ))}
            </linearGradient>
          ) : null,
        )}
      </defs>
      {paths.body.map((d, i) => (
        <path key={i} d={d} style={{ fill: fillOf(body, "body"), fillOpacity: body.opacity }} />
      ))}
      {paths.star.map((d, i) => (
        <path key={`s${i}`} d={d} style={{ fill: fillOf(star, "star"), fillOpacity: star.opacity }} />
      ))}
    </svg>
  );
}
