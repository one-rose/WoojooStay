import { Suspense } from "react";
import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { isLiveApi } from "@/infrastructure";
import { StaffScreen } from "@/ui/pms";
import {
  addEmployeeAction,
  editAttendanceAction,
  payrollAction,
  sendContractAction,
  setShiftAction,
  updateEmployeeAction,
} from "../../_lib/actions";
import { getRepository } from "../../_lib/session";

export const metadata: Metadata = { title: "알바관리" };

export default function StaffPage({ searchParams }: PageProps<"/app/staff">) {
  return (
    <Suspense fallback={<div className="pm-skeleton" aria-busy="true" aria-label="불러오는 중" />}>
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
  const { payMonth } = await searchParams;
  const repo = await getRepository();
  const data = await repo.getStaff();
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
      payMonths={isLiveApi ? payMonths : undefined}
      payroll={other ? { month: picked, rows: other.payroll, members: other.members } : undefined}
      actions={
        isLiveApi
          ? {
              addEmployee: addEmployeeAction,
              sendContract: sendContractAction,
              editAttendance: editAttendanceAction,
              setShift: setShiftAction,
              payroll: payrollAction,
              updateEmployee: updateEmployeeAction,
            }
          : undefined
      }
    />
  );
}
