import { Suspense } from "react";
import type { Metadata } from "next";
import { isLiveApi } from "@/infrastructure";
import { ExpensesScreen, ScreenSkeleton } from "@/ui/pms";
import {
  addExpenseAction,
  addOrderAction,
  deleteExpenseAction,
  registerReceiptAction,
  setOrderStatusAction,
  updateExpenseAction,
  uploadReceiptAction,
} from "../../_lib/actions";
import { getRepository } from "../../_lib/session";

export const metadata: Metadata = { title: "지출관리" };

export default function ExpensesPage({ searchParams }: PageProps<"/app/expenses">) {
  return (
    <Suspense fallback={<ScreenSkeleton strip={3} rows={4} />}>
      <Expenses searchParams={searchParams} />
    </Suspense>
  );
}

async function Expenses({ searchParams }: { searchParams: PageProps<"/app/expenses">["searchParams"] }) {
  const { month } = await searchParams;
  const m = typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined;
  const pmsRepository = await getRepository();
  const dashboard = await pmsRepository.getDashboard();
  // 앞으로 올 달은 이번 달로
  const pick = m && m <= dashboard.date.slice(0, 7) ? m : undefined;
  const data = await pmsRepository.getExpenses(pick);
  return (
    <ExpensesScreen
      data={data}
      today={dashboard.date}
      navigable={isLiveApi}
      actions={
        isLiveApi
          ? {
              addExpense: addExpenseAction,
              updateExpense: updateExpenseAction,
              deleteExpense: deleteExpenseAction,
              uploadReceipt: uploadReceiptAction,
              registerReceipt: registerReceiptAction,
              addOrder: addOrderAction,
              setOrderStatus: setOrderStatusAction,
            }
          : undefined
      }
    />
  );
}
