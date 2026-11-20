import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { isLiveApi, pmsRepository as sample } from "@/infrastructure";
import { LedgerScreen, ScreenSkeleton } from "@/ui/pms";
import { setAdSpendAction } from "../../_lib/actions";
import { getRepository } from "../../_lib/session";

export const metadata: Metadata = { title: "디지털매출장부" };

export default function LedgerPage({ searchParams }: PageProps<"/app/ledger">) {
  return (
    <Suspense fallback={<ScreenSkeleton strip={4} rows={3} />}>
      <Ledger searchParams={searchParams} />
    </Suspense>
  );
}

async function Ledger({ searchParams }: { searchParams: PageProps<"/app/ledger">["searchParams"] }) {
  const { month } = await searchParams;
  // 예시 채널 이름표도 오늘 날짜로 옮겨 만든다 — 빌드 때 굳히지 않게 요청 시점에
  await connection();
  const m = typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined;
  const pmsRepository = await getRepository();
  const [data, channels, dashboard] = await Promise.all([
    pmsRepository.getLedger(m),
    sample.getChannels() /* 채널 이름표 */,
    pmsRepository.getDashboard(),
  ]);
  return (
    <LedgerScreen
      data={data}
      channels={channels}
      today={dashboard.date}
      navigable={isLiveApi}
      live={isLiveApi}
      actions={isLiveApi ? { setAdSpend: setAdSpendAction } : undefined}
    />
  );
}
