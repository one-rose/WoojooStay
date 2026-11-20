import { addMonths, monthStart } from '../common/utils/dates.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/** 업장 하나의 그 달 비용 (PO-21) */
export interface MonthCosts {
  /** 지출 합계 (지출일 기준 그 달) */
  expenses: number;
  /** 인건비 — 확정(발송 포함) 급여 합. 확정 전이면 계산 중(DRAFT) 합 */
  payroll: number;
  /** 'CONFIRMED' 확정·발송분 / 'DRAFT' 계산 중 / null 급여 기록 없음 */
  payrollStatus: 'CONFIRMED' | 'DRAFT' | null;
  /** (지출 + 인건비) ÷ 매출, 소수 셋째 자리. 매출이 0 이면 null */
  costRatio: number | null;
}

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/** 업장 여러 곳의 그 달 지출·인건비 — 쿼리 두 번 */
export async function monthCosts(
  prisma: PrismaService,
  ids: readonly string[],
  month: string,
): Promise<Map<string, Omit<MonthCosts, 'costRatio'>>> {
  const out = new Map<string, Omit<MonthCosts, 'costRatio'>>();
  if (ids.length === 0) return out;
  const idList = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));
  const from = monthStart(month);
  const to = monthStart(addMonths(month, 1));
  const [expenses, payroll] = await Promise.all([
    prisma.expense.groupBy({
      by: ['propertyId'],
      where: { propertyId: { in: [...ids] }, expenseDate: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
    prisma.$queryRaw<{ property_id: string; confirmed: bigint | null; confirmed_n: bigint; draft: bigint | null }[]>(
      Prisma.sql`
        SELECT e.property_id::text AS property_id,
          SUM(p.total_amount) FILTER (WHERE p.status IN ('CONFIRMED', 'SENT')) AS confirmed,
          COUNT(*) FILTER (WHERE p.status IN ('CONFIRMED', 'SENT')) AS confirmed_n,
          SUM(p.total_amount) FILTER (WHERE p.status = 'DRAFT') AS draft
        FROM wj_payroll p JOIN wj_employee e ON e.id = p.employee_id
        WHERE e.property_id IN (${idList}) AND p.pay_month = ${from}
        GROUP BY e.property_id`,
    ),
  ]);
  const exBy = new Map(expenses.map((r) => [r.propertyId, r._sum.amount ?? 0]));
  const payBy = new Map(payroll.map((r) => [r.property_id, r]));
  for (const id of ids) {
    const p = payBy.get(id);
    const confirmed = n(p?.confirmed_n) > 0;
    out.set(id, {
      expenses: exBy.get(id) ?? 0,
      payroll: p ? (confirmed ? n(p.confirmed) : n(p.draft)) : 0,
      payrollStatus: p ? (confirmed ? 'CONFIRMED' : 'DRAFT') : null,
    });
  }
  return out;
}

/** 비용 + 매출 대비 비율 */
export function withRatio(c: Omit<MonthCosts, 'costRatio'> | undefined, sales: number): MonthCosts {
  const base = c ?? { expenses: 0, payroll: 0, payrollStatus: null };
  return {
    ...base,
    costRatio: sales > 0 ? Math.round(((base.expenses + base.payroll) / sales) * 1000) / 1000 : null,
  };
}
