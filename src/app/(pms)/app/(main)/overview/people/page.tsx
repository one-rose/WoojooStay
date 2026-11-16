import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLiveApi } from "@/infrastructure";
import { PeopleScreen } from "@/ui/pms";
import { assignPeopleAction, invitePeopleAction } from "../../../_lib/actions";
import { loadPeople } from "../../../_lib/portfolio";

export const metadata: Metadata = { title: "직원·권한" };

/** 업장별 매니저 권한 (F8) — 사장님 업장 전부의 사람과 권한 */
export default function PeoplePage() {
  return (
    <Suspense fallback={<div className="pm-skeleton" aria-busy="true" aria-label="불러오는 중" />}>
      <People />
    </Suspense>
  );
}

async function People() {
  const data = await loadPeople();
  // 사장님인 업장이 없으면 (매니저만) 권한을 정할 수 없다 — 전체 현황으로
  if (data.properties.length === 0) redirect("/app/overview");
  return (
    <PeopleScreen
      data={data}
      actions={isLiveApi ? { assign: assignPeopleAction, invite: invitePeopleAction } : undefined}
    />
  );
}
