import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { kstDay } from "@/shared";
import { ReportScreen, ScreenSkeleton } from "@/ui/pms";
import { switchPropertyAction } from "../../../_lib/actions";
import { loadPortfolio, loadPortfolioReport } from "../../../_lib/portfolio";

export const metadata: Metadata = { title: "업장 비교" };

/** 업장 비교 리포트 (F8) — ?month=YYYY-MM (기본 이번 달) · ?period=yesterday|week (전체 현황 숫자로 짧게) */
export default function ReportPage({ searchParams }: PageProps<"/app/overview/report">) {
  return (
    <Suspense fallback={<ScreenSkeleton strip={0} rows={6} />}>
      <Report searchParams={searchParams} />
    </Suspense>
  );
}

async function Report({ searchParams }: { searchParams: PageProps<"/app/overview/report">["searchParams"] }) {
  const { month, period: rawPeriod } = await searchParams;
  const valid = typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined;
  const period = rawPeriod === "yesterday" || rawPeriod === "week" ? rawPeriod : "month";
  // 미답변 · 보고 요약은 전체 현황 숫자로 (어제 · 이번 주는 그 기간 매출도)
  const [report, snapshot] = await Promise.all([
    loadPortfolioReport(valid),
    loadPortfolio(period === "month" ? "today" : period).catch(() => undefined),
  ]);
  if (report.properties.length < 2) redirect("/app/ledger");
  return (
    <ReportScreen
      key={`${period}:${report.month}`}
      report={report}
      thisMonth={kstDay(new Date().toISOString()).slice(0, 7)}
      switchProperty={switchPropertyAction}
      period={period}
      snapshot={snapshot}
    />
  );
}
