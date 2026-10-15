import { smoothPath, type Point } from "@/shared";
import { OrbMark } from "../../brand";
import styles from "./TrendChart.module.css";

/** 예시 그래프 모양 (viewBox 740×246 좌표). 실제 데이터 연동 시 값 → 좌표 변환으로 교체 */
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

/** 예약매출 추이 선 그래프 */
export function TrendChart({ title }: { title: string }) {
  const line = smoothPath(SAMPLE_POINTS);
  const first = SAMPLE_POINTS[0];
  const last = SAMPLE_POINTS[SAMPLE_POINTS.length - 1];

  return (
    <div className={styles.trend}>
      <span className={styles.title}>{title}</span>
      <div className={styles.plot}>
        <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} preserveAspectRatio="none" aria-hidden="true">
          {GRID_LINES.map((y) => (
            <line key={y} x1="6" x2="738" y1={y} y2={y} className={styles.grid} vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`${line} L${last[0]},${VIEW.baseline} L${first[0]},${VIEW.baseline} Z`} className={styles.area} />
          <path d={line} className={styles.line} vectorEffect="non-scaling-stroke" />
        </svg>
        {SAMPLE_POINTS.slice(1, -1).map(([x, y]) => (
          <span
            key={x}
            className={styles.dot}
            style={{ left: `${(x / VIEW.width) * 100}%`, top: `${(y / VIEW.height) * 100}%` }}
          >
            <OrbMark className={styles.dotMark} />
          </span>
        ))}
      </div>
    </div>
  );
}
