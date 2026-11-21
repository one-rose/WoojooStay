import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ApiError, isLiveApi } from "@/infrastructure";
import { ClockQrPrint } from "@/ui/pms";
import { rotateClockQrAction } from "../../_lib/actions";
import { loadPropertySwitcher } from "../../_lib/portfolio";
import { getRepository } from "../../_lib/session";

export const metadata: Metadata = { title: "출근 QR 인쇄" };

/** 출근 QR 인쇄 (A4) — 사이드바 없이 종이 한 장. 사장님·매니저, QR 새로 만들기는 사장님만 */
export default function ClockQrPage() {
  return (
    <Suspense fallback={<div className="pm-loading" aria-busy="true" aria-label="불러오는 중" />}>
      <ClockQr />
    </Suspense>
  );
}

async function ClockQr() {
  const repo = await getRepository();
  const [qr, switcher] = await Promise.all([
    repo.getClockQr().catch((e: unknown) => {
      // 직원(STAFF)은 볼 수 없다 — 본인 출퇴근 화면으로
      if (e instanceof ApiError && e.status === 403) redirect("/app/me");
      throw e;
    }),
    loadPropertySwitcher(),
  ]);
  const role = switcher.options.find((o) => o.id === switcher.currentId)?.role;
  return (
    <ClockQrPrint
      data={qr}
      demo={!isLiveApi}
      rotate={isLiveApi && role === "owner" ? rotateClockQrAction : undefined}
    />
  );
}
