import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isPortfolioPeriod } from "@/core";
import { OverviewScreen, ScreenSkeleton } from "@/ui/pms";
import { switchPropertyAction } from "../../_lib/actions";
import { loadPortfolio } from "../../_lib/portfolio";

export const metadata: Metadata = { title: "전체 현황" };

/** 여러 업장 통합 현황 (F8) — 업장 2곳 이상일 때 로그인 후 첫 화면. ?period=yesterday|week 로 매출 기간 */
export default function OverviewPage({ searchParams }: PageProps<"/app/overview">) {
  return (
    <Suspense fallback={<ScreenSkeleton strip={4} rows={5} />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

async function Overview({ searchParams }: { searchParams: PageProps<"/app/overview">["searchParams"] }) {
  const { period: raw } = await searchParams;
  const period = isPortfolioPeriod(raw) ? raw : "today";
  const data = await loadPortfolio(period);
  // 업장이 1곳이면 통합 현황 대신 그 업장 홈
  if (data.properties.length < 2) redirect("/app");
  return <OverviewScreen key={period} data={data} switchProperty={switchPropertyAction} period={period} />;
}
