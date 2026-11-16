import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { OpsData, StaffMeData } from "@/core";
import { connection } from "next/server";
import { ApiError, demoDates, isLiveApi, pmsApi, pmsRepository, toOps, toStaffMe } from "@/infrastructure";
import { StaffMeScreen } from "@/ui/pms";
import { addNoteAction, clockAction, readNoteAction, setRoomStatusAction } from "../../_lib/actions";
import { readSession } from "../../_lib/session";

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
    shifts: ["day", "day", "off", "day", "day", "off", "day"],
  },
  month: { hours: 49, nightHours: 0, estimatedPay: 539_000 },
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
  if (!s.propertyId) redirect("/app/login");
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
      logoutPath="/app/session/logout"
      ops={ops}
      opsActions={{ setRoomStatus: setRoomStatusAction, readNote: readNoteAction, addNote: addNoteAction }}
    />
  );
}
