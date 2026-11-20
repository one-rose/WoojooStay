"use server";

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import type {
  ActionResult,
  AdminOperator,
  AdminPilotKpi,
  AdminPilotSurvey,
  AdminPropertyDetail,
  AdminSupportNote,
  AdminSupportNoteKind,
} from "@/core";
import {
  ApiAuthError,
  ApiError,
  pmsApi,
  toAdminOperators,
  toAdminPilotKpi,
  toAdminPropertyDetail,
  toAdminSurvey,
  toSupportNote,
} from "@/infrastructure";
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

/** 업장 상세 — 사장님·구성원·채널·결제 */
export async function adminPropertyAction(propertyId: string): Promise<ActionResult<AdminPropertyDetail>> {
  const client = await api();
  try {
    return { ok: true, data: toAdminPropertyDetail(await guard(() => client.adminProperty(propertyId))) };
  } catch (e) {
    unstable_rethrow(e);
    return fail(e);
  }
}

/** 담당 운영자 지정 (null 이면 해제) */
export async function assignAdminManagerAction(
  propertyId: string,
  managerId: string | null,
): Promise<ActionResult<AdminPropertyDetail>> {
  const client = await api();
  try {
    return {
      ok: true,
      data: toAdminPropertyDetail(await guard(() => client.adminAssignManager(propertyId, managerId))),
    };
  } catch (e) {
    unstable_rethrow(e);
    return fail(e);
  }
}

/** 담당으로 고를 수 있는 운영자 목록 */
export async function adminOperatorsAction(): Promise<ActionResult<AdminOperator[]>> {
  const client = await api();
  try {
    return { ok: true, data: toAdminOperators(await guard(() => client.adminList())) };
  } catch (e) {
    unstable_rethrow(e);
    return fail(e);
  }
}

/* ── 실증 측정 · 운영 도구 ── */

/** 실증 업장 지정·해제 (group null 이면 해제) */
export async function setPilotAction(
  propertyId: string,
  group: string | null,
  startedAt?: string,
): Promise<ActionResult> {
  const client = await api();
  try {
    await guard(() => client.adminSetPilot(propertyId, group, startedAt));
    return { ok: true, data: undefined };
  } catch (e) {
    unstable_rethrow(e);
    return fail(e);
  }
}

/** 실증 설문 값 — 보낸 칸만 */
export async function savePilotSurveyAction(
  propertyId: string,
  survey: Partial<AdminPilotSurvey>,
): Promise<ActionResult<AdminPilotSurvey>> {
  const client = await api();
  try {
    const r = toAdminSurvey(await guard(() => client.adminSaveSurvey(propertyId, survey)));
    return r ? { ok: true, data: r } : { ok: false, message: "저장하지 못했어요." };
  } catch (e) {
    unstable_rethrow(e);
    return fail(e);
  }
}

export async function addSupportNoteAction(
  propertyId: string,
  kind: AdminSupportNoteKind,
  body: string,
): Promise<ActionResult<AdminSupportNote>> {
  const client = await api();
  try {
    return { ok: true, data: toSupportNote(await guard(() => client.adminAddNote(propertyId, kind, body))) };
  } catch (e) {
    unstable_rethrow(e);
    return fail(e);
  }
}

export async function removeSupportNoteAction(propertyId: string, noteId: string): Promise<ActionResult> {
  const client = await api();
  try {
    await guard(() => client.adminRemoveNote(propertyId, noteId));
    return { ok: true, data: undefined };
  } catch (e) {
    unstable_rethrow(e);
    return fail(e);
  }
}

/** 실증 KPI — 다른 묶음 */
export async function loadPilotAction(group?: string): Promise<ActionResult<AdminPilotKpi>> {
  const client = await api();
  try {
    return { ok: true, data: toAdminPilotKpi(await guard(() => client.adminPilot(group))) };
  } catch (e) {
    unstable_rethrow(e);
    return fail(e);
  }
}
