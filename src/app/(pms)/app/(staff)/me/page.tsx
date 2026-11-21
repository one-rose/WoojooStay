import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { OpsData, StaffMeData } from "@/core";
import { connection } from "next/server";
import { ApiError, demoDates, isLiveApi, pmsApi, pmsRepository, toOps, toStaffMe } from "@/infrastructure";
import { StaffMeScreen } from "@/ui/pms";
import {
  addNoteAction,
  clockAction,
  clockRequestAction,
  readNoteAction,
  setRoomStatusAction,
  undoClockOutAction,
} from "../../_lib/actions";
import { isMyProperty, readSession, redirectToPick } from "../../_lib/session";

export const metadata: Metadata = { title: "출퇴근" };

/** 예시 화면 (API 서버 없이) */
const SAMPLE: StaffMeData = {
  date: "2026-11-10",
  property: "스테이 오르빗 을지로",
  employee: { id: "sample", name: "김민지", role: "front" },
  state: "ready",
  today: { shift: "day" },
  week: {
    dates: ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"],
    shifts: ["day", "day", "off", "day", "day", "off", "unset"],
  },
  nextWeek: {
    dates: ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"],
    shifts: ["day", "off", "day", "day", "unset", "unset", "unset"],
  },
  coworkers: [
    { name: "한상우", shift: "day", working: true },
    { name: "이수연", shift: "day", working: false },
    { name: "박준호", shift: "night", working: false },
  ],
  // 사장님 급여 화면과 같은 계산 — 49시간 × 11,000원, 주 15시간 넘긴 주 1주 (40시간 미만이라 비례)
  month: { hours: 49, nightHours: 0, estimatedPay: 539_000 + 61_600 },
  pay: {
    type: "hourly",
    rate: 11_000,
    hours: 49,
    base: 539_000,
    nightHours: 0,
    night: 0,
    weeklyHours: 5.6,
    weekly: 61_600,
    total: 539_000 + 61_600,
    status: null,
  },
  records: [
    { date: "2026-11-09", in: "08:58", out: "16:02", hours: 7.1, edited: false },
    { date: "2026-11-07", in: "09:00", out: "16:00", hours: 7, edited: true },
  ],
};

/** 직원(STAFF) 본인 출퇴근 — 사이드바 없는 모바일 화면 (F5-02) */
export default function StaffMePage() {
  return (
    <Suspense fallback={<div className="pm-loading" aria-busy="true" />}>
      <Me />
    </Suspense>
  );
}

async function Me() {
  if (!isLiveApi) {
    await connection();
    return <StaffMeScreen data={demoDates(SAMPLE)} ops={await pmsRepository.getOps()} />;
  }
  const s = await readSession();
  if (!s.accessToken) redirect(s.refreshToken ? "/app/session/refresh" : "/app/login");
  // 고른 업장이 없거나 그 업장에서 빠졌으면 남은 업장으로 다시 고른다
  if (!s.propertyId || !(await isMyProperty(s.accessToken, s.propertyId))) return redirectToPick();
  const api = pmsApi(s.accessToken);
  let data: StaffMeData | null = null;
  let message = "";
  // 현장 업무는 부가 정보 — 실패해도 출퇴근 화면은 그대로 보여준다
  const opsLoad = api.ops(s.propertyId).then(toOps, () => null);
  try {
    data = toStaffMe(await api.staffMe(s.propertyId));
  } catch (e) {
    if (!(e instanceof ApiError) || e.status === 401) redirect("/app/session/refresh");
    message = e.message;
  }
  const ops: OpsData | null = await opsLoad;
  return (
    <StaffMeScreen
      data={data}
      message={message}
      clock={clockAction}
      requestClock={clockRequestAction}
      undoOut={undoClockOutAction}
      logoutPath="/app/session/logout"
      ops={ops}
      opsActions={{ setRoomStatus: setRoomStatusAction, readNote: readNoteAction, addNote: addNoteAction }}
    />
  );
}
