import { Suspense } from "react";
import type { Metadata } from "next";
import { isLiveApi } from "@/infrastructure";
import { addDays } from "@/shared";
import { RatesScreen } from "@/ui/pms";
import { getRepository } from "../../_lib/session";

export const metadata: Metadata = { title: "요금·재고" };

export default function RatesPage() {
  return (
    <Suspense fallback={<div className="pm-skeleton" aria-busy="true" aria-label="불러오는 중" />}>
      <Rates />
    </Suspense>
  );
}

/**
 * 요금·재고 — 채널 요금 연동 API 가 아직 없어 예시 표를 보여준다.
 * 실서버에서는 오늘 날짜부터 보이게 맞추고, 고치거나 저장할 수 없게(미리 보기) 둔다.
 */
async function Rates() {
  const repo = await getRepository();
  const [grid, dashboard] = await Promise.all([repo.getRateGrid(), repo.getDashboard()]);
  const today = dashboard.date;
  const shown = isLiveApi ? { ...grid, startDate: today, dates: grid.dates.map((_, i) => addDays(today, i)) } : grid;
  return <RatesScreen grid={shown} today={today} readOnly={isLiveApi} />;
}
