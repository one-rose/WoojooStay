import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { FinanceKind, FinancePreviewData, FinanceSettlement } from "@/core";
import { isLiveApi } from "@/infrastructure";
import { FinancePreviewScreen, ScreenSkeleton } from "@/ui/pms";
import { financeInterestAction } from "../../../_lib/actions";
import { getRepository } from "../../../_lib/session";

export const metadata: Metadata = { title: "금융 미리보기" };

const isKind = (v: string): v is FinanceKind => v === "settle" || v === "advance";

/** 매출선정산 · 미래매출선지급 미리보기 (2단계 WOOJOO ORBIT) — 신청·입금 없음 */
export default function FinancePage({ params }: PageProps<"/app/finance/[kind]">) {
  return (
    <Suspense fallback={<ScreenSkeleton strip={3} rows={4} />}>
      <Finance params={params} />
    </Suspense>
  );
}

const nextMonthOf = (date: string) => {
  const d = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 1));
  return d.toISOString().slice(0, 7);
};

async function Finance({ params }: { params: PageProps<"/app/finance/[kind]">["params"] }) {
  const { kind } = await params;
  if (!isKind(kind)) notFound();
  const repo = await getRepository();
  const dash = await repo.getDashboard();
  const [ledger, next, accounts] = await Promise.all([
    repo.getLedger(dash.date.slice(0, 7)),
    repo.getLedger(nextMonthOf(dash.date)).catch(() => null),
    repo.getChannelAccounts().catch(() => []),
  ]);
  const names = new Map<string, string>([
    ...accounts.map((a) => [a.channel, a.name] as const),
    ...dash.channels.map((c) => [c.channel, c.name] as const),
  ]);
  // 오늘부터 30일 안 · 아직 안 들어온 정산 (두 달 달력 + 홈의 7일 정산을 합치고 겹치는 것은 하나로)
  const end = Date.parse(`${dash.date}T00:00:00Z`) + 30 * 86_400_000;
  const seen = new Set<string>();
  const settlements: FinanceSettlement[] = [];
  const add = (date: string, channel: FinanceSettlement["channel"], amount: number) => {
    const t = Date.parse(`${date}T00:00:00Z`);
    const key = `${date}|${channel}`;
    if (t < Date.parse(`${dash.date}T00:00:00Z`) || t > end || seen.has(key) || amount <= 0) return;
    seen.add(key);
    settlements.push({ date, channel, channelName: names.get(channel) ?? channel, amount });
  };
  for (const day of [...ledger.calendar.days, ...(next?.calendar.days ?? [])])
    for (const i of day.items) if (!i.done) add(day.date, i.channel, i.amount);
  for (const s of dash.settlements) add(s.date, s.channel, s.amount);
  settlements.sort((a, b) => a.date.localeCompare(b.date) || a.channelName.localeCompare(b.channelName, "ko"));

  const data: FinancePreviewData = {
    date: dash.date,
    propertyName: dash.property.name,
    settlements,
    upcomingSales: ledger.upcoming?.sales ?? null,
    trend: ledger.trend.slice(-6),
  };
  return (
    <FinancePreviewScreen key={kind} kind={kind} data={data} interest={isLiveApi ? financeInterestAction : undefined} />
  );
}
