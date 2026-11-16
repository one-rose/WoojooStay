import { Suspense } from "react";
import type { Metadata } from "next";
import { isLiveApi } from "@/infrastructure";
import { ExpensesScreen } from "@/ui/pms";
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

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div className="pm-skeleton" aria-busy="true" aria-label="불러오는 중" />}>
      <Expenses />
    </Suspense>
  );
}

async function Expenses() {
  const pmsRepository = await getRepository();
  const [data, dashboard] = await Promise.all([pmsRepository.getExpenses(), pmsRepository.getDashboard()]);
  return (
    <ExpensesScreen
      data={data}
      today={dashboard.date}
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
