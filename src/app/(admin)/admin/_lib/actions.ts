"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/core";
import { ApiAuthError, ApiError, pmsApi } from "@/infrastructure";
import { ADMIN_COOKIE, adminCookieOptions, requireAdminToken } from "./session";

/** 운영자 화면 → API 서버 (토큰은 서버 쿠키에서만) */

const fail = (e: unknown): { ok: false; message: string; errorCode?: string } =>
  e instanceof ApiError
    ? { ok: false, message: e.message, errorCode: e.errorCode }
    : { ok: false, message: "서버와 연결하지 못했어요. 잠시 후 다시 시도해 주세요." };

async function api() {
  const token = await requireAdminToken();
  if (!token) redirect("/admin");
  return pmsApi(token);
}

/** 토큰 만료면 쿠키를 지우고 로그인으로 */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiAuthError) {
      (await cookies()).delete(ADMIN_COOKIE);
      redirect("/admin/login");
    }
    throw e;
  }
}

export async function adminLoginAction(email: string, password: string): Promise<ActionResult<{ next: string }>> {
  try {
    const r = await pmsApi().adminLogin(email, password);
    (await cookies()).set(ADMIN_COOKIE, r.accessToken, adminCookieOptions(r.expiresIn - 60));
    return { ok: true, data: { next: "/admin" } };
  } catch (e) {
    return fail(e);
  }
}

export async function retrySyncAction(id: string): Promise<ActionResult<{ status: string; message: string | null }>> {
  const client = await api();
  try {
    const r = await guard(() => client.adminRetrySync(id));
    return { ok: true, data: { status: r.status, message: r.lastError } };
  } catch (e) {
    return fail(e);
  }
}

export async function notifySyncAction(id: string): Promise<ActionResult> {
  const client = await api();
  try {
    await guard(() => client.adminNotifySync(id));
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function setInquiryStatusAction(id: string, status: "new" | "contacted" | "done"): Promise<ActionResult> {
  const client = await api();
  try {
    await guard(() => client.adminUpdateInquiry(id, { status: status.toUpperCase() as "NEW" | "CONTACTED" | "DONE" }));
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
