import { smoothPath, type Point } from "@/shared";
import { OrbMark } from "../../brand";

/** 예시 추이 (SVG 좌표, viewBox 740×246 기준) */
const SAMPLE_POINTS: readonly Point[] = [
  [17, 194],
  [55, 185],
  [120, 163],
  [222, 154],
  [345, 90],
  [408, 94],
  [543, 42],
  [631, 45],
  [703, 6],
  [723, 9],
];
const VIEW = { width: 740, height: 246, baseline: 242 };
const GRID_LINES = [60, 110, 160, 210];

/** 예약매출 추이 그래프 */
export function TrendChart({ title, axis }: { title: string; axis: readonly string[] }) {
  const line = smoothPath(SAMPLE_POINTS);
  const first = SAMPLE_POINTS[0];
  const last = SAMPLE_POINTS[SAMPLE_POINTS.length - 1];
  return (
    <div className="trend">
      <span className="trend__title">{title}</span>
      <div className="trend__plot">
        <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} preserveAspectRatio="none" aria-hidden="true">
          {GRID_LINES.map((y) => (
            <line key={y} x1="6" x2="738" y1={y} y2={y} className="trend__grid" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`${line} L${last[0]},${VIEW.baseline} L${first[0]},${VIEW.baseline} Z`} className="trend__area" />
          <path d={line} className="trend__line" vectorEffect="non-scaling-stroke" />
        </svg>
        {SAMPLE_POINTS.slice(1, -1).map(([x, y]) => (
          <span
            key={x}
            className="trend__dot"
            style={{ left: `${(x / VIEW.width) * 100}%`, top: `${(y / VIEW.height) * 100}%` }}
          >
            <OrbMark />
          </span>
        ))}
      </div>
      <div className="trend__axis" aria-hidden="true">
        {axis.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}
