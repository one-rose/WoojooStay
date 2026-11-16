import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { kstDay } from "@/shared";
import { ReportScreen } from "@/ui/pms";
import { switchPropertyAction } from "../../../_lib/actions";
import { loadPortfolioReport } from "../../../_lib/portfolio";

export const metadata: Metadata = { title: "업장 비교" };

/** 업장 비교 리포트 (F8) — ?month=YYYY-MM (기본 이번 달) */
export default function ReportPage({ searchParams }: PageProps<"/app/overview/report">) {
  return (
    <Suspense fallback={<div className="pm-skeleton" aria-busy="true" aria-label="불러오는 중" />}>
      <Report searchParams={searchParams} />
    </Suspense>
  );
}

async function Report({ searchParams }: { searchParams: PageProps<"/app/overview/report">["searchParams"] }) {
  const { month } = await searchParams;
  const valid = typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined;
  const report = await loadPortfolioReport(valid);
  if (report.properties.length < 2) redirect("/app/ledger");
  return (
    <ReportScreen
      report={report}
      thisMonth={kstDay(new Date().toISOString()).slice(0, 7)}
      switchProperty={switchPropertyAction}
    />
  );
}
