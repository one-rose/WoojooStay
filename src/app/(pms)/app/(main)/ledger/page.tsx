import { Suspense } from "react";
import type { Metadata } from "next";
import { isLiveApi, pmsRepository as sample } from "@/infrastructure";
import { LedgerScreen } from "@/ui/pms";
import { getRepository } from "../../_lib/session";

export const metadata: Metadata = { title: "디지털매출장부" };

export default function LedgerPage({ searchParams }: PageProps<"/app/ledger">) {
  return (
    <Suspense fallback={<div className="pm-skeleton" aria-busy="true" aria-label="불러오는 중" />}>
      <Ledger searchParams={searchParams} />
    </Suspense>
  );
}

async function Ledger({ searchParams }: { searchParams: PageProps<"/app/ledger">["searchParams"] }) {
  const { month } = await searchParams;
  const m = typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined;
  const pmsRepository = await getRepository();
  const [data, channels, dashboard] = await Promise.all([
    pmsRepository.getLedger(m),
    sample.getChannels() /* 채널 이름표 */,
    pmsRepository.getDashboard(),
  ]);
  return <LedgerScreen data={data} channels={channels} today={dashboard.date} navigable={isLiveApi} live={isLiveApi} />;
}
