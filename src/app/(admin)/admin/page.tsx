import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ApiAuthError, loadAdminData, pmsRepository } from "@/infrastructure";
import { AdminScreen, AdminShell } from "@/ui/pms";
import { notifySyncAction, retrySyncAction, setInquiryStatusAction } from "./_lib/actions";
import { ADMIN_COOKIE, requireAdminToken } from "./_lib/session";

export const metadata: Metadata = { title: "운영자 백오피스" };

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="pm-loading" aria-busy="true" />}>
      <Office />
    </Suspense>
  );
}

async function Office() {
  await connection(); // 체험 모드 날짜를 요청마다 오늘 기준으로
  const token = await requireAdminToken();
  const channels = await pmsRepository.getChannels(); // 채널 이름표
  if (!token) {
    const data = await pmsRepository.getAdmin();
    return (
      <AdminShell>
        <AdminScreen data={data} channels={channels} />
      </AdminShell>
    );
  }
  let data;
  try {
    data = await loadAdminData(token);
  } catch (e) {
    if (e instanceof ApiAuthError) {
      (await cookies()).delete(ADMIN_COOKIE);
      redirect("/admin/login");
    }
    throw e;
  }
  return (
    <AdminShell me={data.me} logoutPath="/admin/logout">
      <AdminScreen
        data={data}
        channels={channels}
        actions={{ retrySync: retrySyncAction, notifySync: notifySyncAction, setInquiryStatus: setInquiryStatusAction }}
      />
    </AdminShell>
  );
}
