export type Point = readonly [x: number, y: number];

/** 점 목록을 Catmull-Rom 스플라인 → 3차 베지어로 바꿔 부드러운 SVG path 를 만든다 */
export function smoothPath(points: readonly Point[]): string {
  if (points.length === 0) return "";
  // 제어점이 데이터 범위 밖으로 나가 곡선이 0 아래(기준선 밖)로 내려가지 않게 y 를 가둔다
  const ys = points.map((p) => p[1]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const clampY = (y: number) => Math.min(hi, Math.max(lo, y));
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, clampY(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, clampY(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}
