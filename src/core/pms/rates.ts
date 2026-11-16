/**
 * 요금·재고 — 객실타입 × 요금제 2단 구조
 * (온다 호텔 익스트라넷 분석 반영: 파생 요금제 자동계산, 판매상태, 변경 확인 목록)
 */

export interface DerivedRule {
  /** 기준 요금제 id */
  from: string;
  sign: 1 | -1;
  value: number;
  unit: "percent" | "won";
}

export interface RatePlan {
  id: string;
  name: string;
  /** 있으면 기준 요금제 가격에서 자동 계산 (직접 입력 불가) */
  derived?: DerivedRule;
  meal?: string;
}

export interface RoomType {
  id: string;
  name: string;
  plans: readonly RatePlan[];
}

/** 하루치 칸. null = 아직 입력 안 함 (0 과 다름) */
export interface RateCell {
  stock: number | null;
  price: number | null;
  open: boolean;
}

export interface RateGrid {
  /** 첫 날짜 "YYYY-MM-DD" */
  startDate: string;
  dates: readonly string[];
  roomTypes: readonly RoomType[];
  /** planId → 날짜 순서대로의 칸 */
  cells: Readonly<Record<string, readonly RateCell[]>>;
}

export type RateField = "stock" | "price" | "open";

export interface RateChange {
  roomType: string;
  plan: string;
  planId: string;
  date: string;
  field: RateField;
  before: RateCell[RateField];
  after: RateCell[RateField];
}

/** 파생 요금제 가격 (100원 단위 반올림). 기준 가격이 없으면 null */
export function derivePrice(base: number | null, rule: DerivedRule): number | null {
  if (base === null) return null;
  const delta = rule.unit === "percent" ? (base * rule.value) / 100 : rule.value;
  return Math.max(0, Math.round((base + rule.sign * delta) / 100) * 100);
}

export function describeRule(rule: DerivedRule, baseName: string): string {
  const sign = rule.sign > 0 ? "+" : "−";
  const amount = rule.unit === "percent" ? `${rule.value}%` : `${rule.value.toLocaleString("ko-KR")}원`;
  return `${baseName} ${sign}${amount}`;
}

/** 원래 값과 고친 값을 비교해 바뀐 항목을 모두 돌려준다 (판매상태 변경 포함) */
export function diffRateGrid(grid: RateGrid, edited: Readonly<Record<string, readonly RateCell[]>>): RateChange[] {
  const changes: RateChange[] = [];
  for (const room of grid.roomTypes) {
    for (const plan of room.plans) {
      if (plan.derived) continue;
      const before = grid.cells[plan.id];
      const after = edited[plan.id];
      if (!before || !after) continue;
      grid.dates.forEach((date, i) => {
        for (const field of ["stock", "price", "open"] as const) {
          if (before[i][field] !== after[i][field]) {
            changes.push({
              roomType: room.name,
              plan: plan.name,
              planId: plan.id,
              date,
              field,
              before: before[i][field],
              after: after[i][field],
            });
          }
        }
      });
    }
  }
  return changes;
}

/** 칸 하나가 실제로 팔릴 수 있는지 — 판매중 + 재고 1 이상 + 요금 입력됨 */
export function isSellable(cell: RateCell): boolean {
  return cell.open && (cell.stock ?? 0) > 0 && cell.price !== null && cell.price > 0;
}
