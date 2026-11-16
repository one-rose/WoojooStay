import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OverviewScreen } from "@/ui/pms";
import { switchPropertyAction } from "../../_lib/actions";
import { loadPortfolio } from "../../_lib/portfolio";

export const metadata: Metadata = { title: "전체 현황" };

/** 여러 업장 통합 현황 (F8) — 업장 2곳 이상일 때 로그인 후 첫 화면 */
export default function OverviewPage() {
  return (
    <Suspense fallback={<div className="pm-skeleton" aria-busy="true" aria-label="불러오는 중" />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const data = await loadPortfolio();
  // 업장이 1곳이면 통합 현황 대신 그 업장 홈
  if (data.properties.length < 2) redirect("/app");
  return <OverviewScreen data={data} switchProperty={switchPropertyAction} />;
}
