import { useId } from "react";
import type { MarkPaths } from "./logo-paths";

interface MarkProps {
  paths: MarkPaths;
  className?: string;
  /** 있으면 스크린리더에 읽히는 그림, 없으면 장식 */
  title?: string;
  bodyFill?: string;
  starFill?: string;
  starOpacity?: string;
  /** 왼쪽 → 오른쪽 그라데이션 색 (주면 본체·별 모두 이 색) */
  gradient?: readonly string[];
}

/** 로고·마크 공통 SVG: 본체(body) + 별(star) 두 겹 */
export function Mark({
  paths,
  className,
  title,
  bodyFill = "currentColor",
  starFill = "currentColor",
  starOpacity = "var(--mark-star-opacity, 1)",
  gradient,
}: MarkProps) {
  const gradientId = useId().replace(/:/g, "");
  const gradientFill = gradient ? `url(#${gradientId})` : undefined;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${paths.w} ${paths.h}`}
      shapeRendering="geometricPrecision"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {gradient && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2={paths.w} y2="0" gradientUnits="userSpaceOnUse">
            {gradient.map((color, i) => (
              <stop key={color} offset={i / (gradient.length - 1)} stopColor={color} />
            ))}
          </linearGradient>
        </defs>
      )}
      {paths.body.map((d, i) => (
        <path key={i} d={d} style={{ fill: gradientFill ?? bodyFill }} />
      ))}
      {paths.star.map((d, i) => (
        <path key={`s${i}`} d={d} style={{ fill: gradientFill ?? starFill, fillOpacity: starOpacity }} />
      ))}
    </svg>
  );
}
