import { Suspense } from "react";
import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { isLiveApi } from "@/infrastructure";
import { StaffScreen, ScreenSkeleton } from "@/ui/pms";
import {
  addEmployeeAction,
  editAttendanceAction,
  payrollAction,
  sendContractAction,
  setShiftAction,
  staffMonthAction,
  updateEmployeeAction,
} from "../../_lib/actions";
import { loadPropertySwitcher } from "../../_lib/portfolio";
import { getRepository } from "../../_lib/session";

export const metadata: Metadata = { title: "알바관리" };

const liveActions = {
  addEmployee: addEmployeeAction,
  sendContract: sendContractAction,
  editAttendance: editAttendanceAction,
  setShift: setShiftAction,
  payroll: payrollAction,
  updateEmployee: updateEmployeeAction,
};

export default function StaffPage({ searchParams }: PageProps<"/app/staff">) {
  return (
    <Suspense fallback={<ScreenSkeleton strip={3} rows={4} />}>
      <Staff searchParams={searchParams} />
    </Suspense>
  );
}

const addMonths = (m: string, n: number) => {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
/** 그 달 마지막 날 */
const monthEnd = (m: string) => {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)), 0));
  return d.toISOString().slice(0, 10);
};

async function Staff({ searchParams }: { searchParams: PageProps<"/app/staff">["searchParams"] }) {
  const { payMonth, week, day } = await searchParams;
  const repo = await getRepository();
  // 교대표 주 이동 — ?week=YYYY-MM-DD (그 날이 속한 주, 월요일 시작)
  const weekOf = typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : undefined;
  const [data, switcher] = await Promise.all([repo.getStaff(undefined, weekOf), loadPropertySwitcher()]);
  // 근태 지난 날짜 — ?day=YYYY-MM-DD (오늘 전만, 그 날 기준으로 다시 부른다)
  const dayOf = typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) && day < data.date ? day : undefined;
  const past = dayOf
    ? await repo.getStaff(dayOf).catch((e: unknown) => {
        unstable_rethrow(e);
        return null;
      })
    : null;
  const attendance = past ? { date: past.date, rows: past.today } : undefined;
  // 지금 업장에서 내 역할 — 매니저는 급여 탭·급여 금액·급여 확정·계약서 발송이 없다
  const role = switcher.options.find((o) => o.id === switcher.currentId)?.role ?? "manager";
  if (role !== "owner")
    return (
      <StaffScreen
        data={data}
        role="manager"
        attendance={attendance}
        actions={isLiveApi ? liveActions : undefined}
        loadMonth={staffMonthAction}
      />
    );
  // 급여는 기본으로 지난달 (이번 달은 아직 진행 중) — 최근 6개월에서 고른다
  const payMonths = Array.from({ length: 6 }, (_, i) => addMonths(data.month, -i));
  const picked =
    typeof payMonth === "string" && payMonths.includes(payMonth) ? payMonth : isLiveApi ? payMonths[1] : data.month;
  const other =
    picked === data.month
      ? data
      : await repo.getStaff(monthEnd(picked)).catch((e: unknown) => {
          unstable_rethrow(e);
          return null;
        });
  return (
    <StaffScreen
      data={data}
      role="owner"
      payMonths={isLiveApi ? payMonths : undefined}
      payroll={other ? { month: picked, rows: other.payroll, members: other.members } : undefined}
      attendance={attendance}
      actions={isLiveApi ? liveActions : undefined}
      loadMonth={staffMonthAction}
    />
  );
}
