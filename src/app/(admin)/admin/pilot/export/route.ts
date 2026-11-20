import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { AdminPilotKpi, AdminPilotWeek } from "@/core";
import { ApiAuthError, demoAdminPilot, isLiveApi, pmsApi, toAdminPilotKpi } from "@/infrastructure";
import { csvCell } from "@/shared";
import { ADMIN_COOKIE } from "../../_lib/session";

/**
 * 실증 KPI 내려받기 (CSV) — 엑셀에서 한글이 깨지지 않게 BOM, 글자 칸은 수식으로 읽히지 않게 csvCell.
 * 업장 × 주(기준선·1~8주) 한 줄씩, 기준선 줄에는 설문 값도.
 */
export async function GET(req: NextRequest) {
  const group = req.nextUrl.searchParams.get("group") ?? undefined;
  let kpi: AdminPilotKpi;
  if (isLiveApi) {
    const token = (await cookies()).get(ADMIN_COOKIE)?.value;
    if (!token) return NextResponse.redirect(new URL("/admin/login", req.url), 303);
    try {
      kpi = toAdminPilotKpi(await pmsApi(token).adminPilot(group));
    } catch (e) {
      if (e instanceof ApiAuthError) return NextResponse.redirect(new URL("/admin/login", req.url), 303);
      throw e;
    }
  } else {
    kpi = demoAdminPilot();
  }
  const pct = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(v * 1000) / 10);
  const head = [
    "업장",
    "실증 묶음",
    "실증 시작일",
    "구분",
    "기간 시작",
    "기간 끝",
    "센 날 수",
    "리뷰",
    "답글",
    "응답률(%)",
    "응답 소요 중앙값(시간)",
    "초안 그대로(%)",
    "사용일",
    "장부·통합 조회일",
    "지출 건수",
    "디지털 지출(%)",
    "급여 확정",
    "명세 발송",
    "계약 서명",
    "출근 기록",
    "앱 출근(%)",
    "평점",
    "평점 변화",
    "AI 초안",
    "다시 쓰기",
    "답글 게시",
    "기준선 하루 채널 확인(분)",
    "기준선 급여 계산 방식",
    "기준선 급여 계산(분/월)",
    "기준선 알바 수",
    "기준선 월 지출 건수",
    "기준선 기록 방식",
    "만족도 4주",
    "만족도 8주",
    "지불의사 요금제",
    "지불의사 업장 수",
  ];
  const rows: (string | number | null)[][] = [];
  for (const p of kpi.properties) {
    for (const w of p.weeks as AdminPilotWeek[]) {
      if (w.future) continue;
      const s = w.week === 0 ? p.survey : null;
      rows.push([
        p.name,
        p.pilot.group,
        p.pilot.startedAt,
        w.week === 0 ? "기준선" : `${w.week}주`,
        w.from,
        w.to,
        w.days,
        w.reviews ?? null,
        w.answered ?? null,
        pct(w.responseRate),
        w.medianResponseHours ?? null,
        pct(w.draftAsIsRate),
        w.activeDays ?? null,
        w.ledgerDays ?? null,
        w.expenses ?? null,
        pct(w.expenseDigitalRate),
        w.payrollConfirmed ?? null,
        w.payslipsSent ?? null,
        w.contractsSigned ?? null,
        w.attendance ?? null,
        pct(w.attendanceAppRate),
        w.rating ?? null,
        w.ratingDelta ?? null,
        w.aiDrafts ?? null,
        w.aiRegenerations ?? null,
        w.aiPosts ?? null,
        s?.channelCheckMinutes ?? null,
        s?.payrollMethod ?? null,
        s?.payrollMinutes ?? null,
        s?.staffCount ?? null,
        s?.monthlyExpenseCount ?? null,
        s?.recordMethod ?? null,
        s?.satisfaction4w ?? null,
        s?.satisfaction8w ?? null,
        s?.wtpPlan ?? null,
        s?.wtpProperties ?? null,
      ]);
    }
  }
  const body = "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
  const name = `실증KPI_${kpi.group ?? "전체"}_${kpi.today}.csv`;
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="pilot-kpi.csv"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "no-store",
    },
  });
}
