"use server";

import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import type {
  ActionResult,
  ChannelId,
  ExpenseInput,
  GuestReview,
  OpsActions,
  RoomLog,
  RoomStatus,
  PropertyInput,
  ReplySettings,
  SettingsActions,
  SignupInput,
  StaffActions,
} from "@/core";
import { redirect } from "next/navigation";
import {
  ApiAuthError,
  ApiError,
  findDemoProperty,
  isLiveApi,
  fromReplySettings,
  pmsApi,
  toApiChannel,
  toApiRoomStatus,
  toReview,
  toRoomLog,
  type ApiPlanCode,
} from "@/infrastructure";
import { safeAppPath } from "@/shared";
import { COOKIE, cookieOptions, requireSession, serverApi } from "./session";

/**
 * 화면 → 우주스테이 API 서버 동작 (Server Functions)
 * 토큰은 서버 쿠키에서만 꺼내 쓰고, 화면에는 결과만 돌려준다.
 */

/** 실패 결과 — redirect·notFound 같은 Next 제어 흐름은 삼키지 않고 다시 던진다 */
function fail(e: unknown): { ok: false; message: string; errorCode?: string; status?: number } {
  unstable_rethrow(e);
  if (e instanceof ApiAuthError)
    return {
      ok: false,
      message: "로그인이 만료됐어요. 화면을 새로고침한 뒤 다시 시도해 주세요.",
      errorCode: e.errorCode,
    };
  if (e instanceof ApiError && e.status === 409)
    return {
      ok: false,
      message: e.message || "다른 사람이 먼저 바꿨어요. 최신 상태로 다시 불러올게요.",
      errorCode: e.errorCode,
      status: 409,
    };
  return e instanceof ApiError
    ? { ok: false, message: e.message, errorCode: e.errorCode, status: e.status }
    : { ok: false, message: "서버와 연결하지 못했어요. 잠시 후 다시 시도해 주세요." };
}

async function saveTokens(t: { accessToken: string; refreshToken: string; expiresIn: number }) {
  const jar = await cookies();
  jar.set(COOKIE.access, t.accessToken, cookieOptions(t.expiresIn - 30));
  jar.set(COOKIE.refresh, t.refreshToken, cookieOptions(30 * 86_400));
}

/** 로그인 후 갈 곳 — 업장이 있으면 첫 업장을 고르고 홈(2곳 이상이면 전체 현황), 없으면 온보딩 */
async function afterLogin(accessToken: string, next?: string): Promise<string> {
  const me = await (await serverApi(accessToken)).me();
  const jar = await cookies();
  const first = me.properties.find((p) => p.role !== "STAFF");
  // 직원(STAFF)만인 계정은 출퇴근 화면으로
  const staffOnly = !first ? me.properties[0] : undefined;
  if (staffOnly) {
    jar.set(COOKIE.property, staffOnly.id, cookieOptions(30 * 86_400));
    return "/app/me";
  }
  if (!first) {
    jar.delete(COOKIE.property);
    return "/app/onboarding";
  }
  const current = jar.get(COOKIE.property)?.value;
  const keep = me.properties.find((p) => p.id === current && p.role !== "STAFF");
  jar.set(COOKIE.property, (keep ?? first).id, cookieOptions(30 * 86_400));
  const managed = me.properties.filter((p) => p.role !== "STAFF").length;
  return safeAppPath(next, managed >= 2 ? "/app/overview" : "/app");
}

/* ── 업장 전환 (F8) ── */

/** 업장을 바꿔도 그대로 열 수 있는 화면만 — 그 밖(전체 현황 · 업장별 상세 주소 등)은 그 업장 홈으로 */
function sectionPath(next: string): string {
  const path = safeAppPath(next.split(/[?#]/)[0], "/app");
  if (path === "/app/overview" || path.startsWith("/app/me") || path.startsWith("/app/onboarding")) return "/app";
  return path;
}

/**
 * 업장 전환 — 내가 사장님·매니저인 업장인지 API(me)로 확인하고 업장 쿠키를 바꾼 뒤,
 * 보던 메뉴 그대로(next) 그 업장 화면을 연다. 체험 모드는 예시 업장 10곳 중에서.
 */
export async function switchPropertyAction(propertyId: string, next: string): Promise<{ ok: false; message: string }> {
  const target = sectionPath(next);
  if (!isLiveApi) {
    if (!findDemoProperty(propertyId)) return { ok: false, message: "업장을 찾지 못했어요." };
    (await cookies()).set(COOKIE.property, propertyId, cookieOptions(30 * 86_400));
    redirect(target);
  }
  const s = await requireSession();
  let allowed = false;
  try {
    const me = await (await serverApi(s.accessToken)).me();
    allowed = me.properties.some((p) => p.id === propertyId && p.role !== "STAFF");
  } catch (e) {
    return fail(e);
  }
  if (!allowed) return { ok: false, message: "이 업장을 관리할 권한이 없어요." };
  (await cookies()).set(COOKIE.property, propertyId, cookieOptions(30 * 86_400));
  redirect(target);
}

/** 로그인한 API 호출기 — try 바깥에서 부른다 (로그인 화면으로 보내는 redirect 가 삼켜지지 않게) */
async function authed() {
  const s = await requireSession();
  return { api: await serverApi(s.accessToken), propertyId: s.propertyId ?? "" };
}

/* ── 가입 · 로그인 (F0-01) ── */

export async function sendCodeAction(
  phone: string,
  purpose: "signup" | "reset" = "signup",
): Promise<ActionResult<{ devCode?: string }>> {
  try {
    const r = await (await serverApi()).sendCode(phone, purpose);
    return { ok: true, data: { devCode: r.devCode } };
  } catch (e) {
    return fail(e);
  }
}

export async function signupAction(input: SignupInput, next?: string): Promise<ActionResult<{ next: string }>> {
  try {
    const api = await serverApi();
    const { verificationToken } = await api.verifyCode(input.phone, "signup", input.code);
    const res = await api.signup({
      verificationToken,
      name: input.name,
      email: input.email || undefined,
      password: input.password,
      agreements: { terms: true, privacy: true, marketing: input.marketing },
    });
    await saveTokens(res);
    // 초대 링크로 들어와 가입한 경우엔 초대 수락 화면으로 돌아간다
    return { ok: true, data: { next: next?.startsWith("/app/invite") ? next : "/app/onboarding" } };
  } catch (e) {
    return fail(e);
  }
}

export async function loginAction(
  phone: string,
  password: string,
  next?: string,
): Promise<ActionResult<{ next: string }>> {
  try {
    const res = await (await serverApi()).login(phone, password);
    await saveTokens(res);
    if (next?.startsWith("/app/invite")) return { ok: true, data: { next } };
    return { ok: true, data: { next: await afterLogin(res.accessToken, next) } };
  } catch (e) {
    return fail(e);
  }
}

/** 비밀번호 재설정 — 휴대폰 인증(reset) 후 새 비밀번호 */
export async function resetPasswordAction(phone: string, code: string, password: string): Promise<ActionResult> {
  try {
    const api = await serverApi();
    const { verificationToken } = await api.verifyCode(phone, "reset", code);
    await api.resetPassword(verificationToken, password);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** 직원 초대 수락 — 초대받은 번호로 로그인한 상태여야 한다 */
export async function acceptInvitationAction(
  token: string,
): Promise<ActionResult<{ next: string; propertyName: string | null }>> {
  const { api } = await authed();
  try {
    const r = await api.acceptInvitation(token);
    (await cookies()).set(COOKIE.property, r.propertyId, cookieOptions(30 * 86_400));
    const me = await api.me().catch(() => null);
    const name = me?.properties.find((p) => p.id === r.propertyId)?.name ?? null;
    return { ok: true, data: { next: r.role === "STAFF" ? "/app/me" : "/app", propertyName: name } };
  } catch (e) {
    return fail(e);
  }
}

/* ── 온보딩 (F0-02, F0-04) ── */

export async function checkBizNoAction(bizNo: string) {
  const { api } = await authed();
  try {
    const r = await api.checkBizNo(bizNo.replace(/\D/g, ""));
    return { ok: true as const, data: { status: r.status } };
  } catch (e) {
    return fail(e);
  }
}

export async function createPropertyAction(input: PropertyInput): Promise<ActionResult<{ id: string }>> {
  const { api } = await authed();
  try {
    const p = await api.createProperty({ ...input, type: input.type.toUpperCase() });
    const jar = await cookies();
    jar.set(COOKIE.property, p.id, cookieOptions(30 * 86_400));
    // 온보딩을 이어서 하는 중 — 이 업장이면 온보딩 화면이 홈으로 보내지 않고 채널 연결부터 잇는다
    jar.set(COOKIE.onboarding, p.id, cookieOptions(86_400));
    return { ok: true, data: { id: p.id } };
  } catch (e) {
    return fail(e);
  }
}

/** 온보딩을 마쳤으면 이어하기 표시를 지운다 */
export async function finishOnboardingAction() {
  (await cookies()).delete(COOKIE.onboarding);
}

export async function connectChannelAction(
  channel: ChannelId,
  loginId: string,
  password: string,
): Promise<ActionResult<{ newReviews: number }>> {
  const { api, propertyId } = await authed();
  try {
    const r = await api.connectChannel(propertyId, toApiChannel(channel), loginId, password);
    return { ok: true, data: { newReviews: r.newReviews } };
  } catch (e) {
    return fail(e);
  }
}

export async function syncChannelAction(channel: ChannelId) {
  return act((api, pid) => api.syncChannel(pid, toApiChannel(channel)));
}

export async function disconnectChannelAction(channel: ChannelId) {
  return act((api, pid) => api.disconnectChannel(pid, toApiChannel(channel)));
}

/* ── AI 리뷰 (F1-03, F1-04, F1-07) ── */

export async function replyAction(
  reviewId: string,
  text: string,
): Promise<ActionResult<{ review: GuestReview; copyTo: string | null }>> {
  const { api, propertyId } = await authed();
  try {
    const r = await api.reply(propertyId, reviewId, text);
    return { ok: true, data: { review: toReview(r), copyTo: r.copyTo ?? null } };
  } catch (e) {
    return fail(e);
  }
}

export async function redraftAction(reviewId: string): Promise<ActionResult<{ review: GuestReview }>> {
  const { api, propertyId } = await authed();
  try {
    return { ok: true, data: { review: toReview(await api.redraft(propertyId, reviewId)) } };
  } catch (e) {
    return fail(e);
  }
}

export async function saveReplySettingsAction(settings: ReplySettings): Promise<ActionResult> {
  const { api, propertyId } = await authed();
  try {
    await api.saveReplySettings(propertyId, fromReplySettings(settings));
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/* ── 공통: 결과 없는 동작 ── */
async function act(
  fn: (api: ReturnType<typeof pmsApi>, propertyId: string) => Promise<unknown>,
): Promise<ActionResult> {
  const { api, propertyId } = await authed();
  try {
    await fn(api, propertyId);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

const upper = <T extends string>(v: T) => v.toUpperCase() as Uppercase<T>;

/* ── 알바관리 (F5) ── */

export async function addEmployeeAction(
  input: Parameters<StaffActions["addEmployee"]>[0],
): Promise<ActionResult<{ belowMinimumWage: boolean }>> {
  const { api, propertyId } = await authed();
  try {
    const r = await api.createEmployee(propertyId, {
      name: input.name,
      phone: input.phone,
      jobRole: upper(input.role),
      payType: upper(input.payType),
      payAmount: input.payAmount,
      hiredDate: input.hiredDate,
    });
    return { ok: true, data: { belowMinimumWage: r.belowMinimumWage } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateEmployeeAction(staffId: string, input: Parameters<StaffActions["updateEmployee"]>[1]) {
  const { api, propertyId } = await authed();
  try {
    const r = await api.updateEmployee(propertyId, staffId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.role ? { jobRole: upper(input.role) } : {}),
      ...(input.payType ? { payType: upper(input.payType) } : {}),
      ...(input.payAmount !== undefined ? { payAmount: input.payAmount } : {}),
      ...(input.resignedDate ? { resignedDate: input.resignedDate } : {}),
    });
    return { ok: true as const, data: { belowMinimumWage: Boolean(r?.belowMinimumWage) } };
  } catch (e) {
    return fail(e);
  }
}

export async function sendContractAction(staffId: string) {
  return act((api, pid) => api.sendContract(pid, staffId));
}

export async function editAttendanceAction(input: Parameters<StaffActions["editAttendance"]>[0]) {
  return act((api, pid) =>
    api.editAttendance(pid, {
      employeeId: input.staffId,
      workDate: input.date,
      clockIn: input.clockIn,
      clockOut: input.clockOut || undefined,
      memo: input.memo || undefined,
    }),
  );
}

export async function setShiftAction(staffId: string, date: string, shift: "day" | "night" | "off") {
  return act((api, pid) => api.setShift(pid, { employeeId: staffId, workDate: date, shiftType: upper(shift) }));
}

export async function payrollAction(month: string, step: "confirm" | "send" | "reopen") {
  return act((api, pid) => api.payroll(pid, month, step));
}

/* ── 지출관리 (F6) ── */

const toExpenseBody = (i: ExpenseInput) => ({ ...i, category: upper(i.category) });

export async function addExpenseAction(input: ExpenseInput) {
  return act((api, pid) => api.createExpense(pid, toExpenseBody(input)));
}

export async function updateExpenseAction(expenseId: string, input: ExpenseInput) {
  return act((api, pid) => api.updateExpense(pid, expenseId, toExpenseBody(input)));
}

export async function deleteExpenseAction(expenseId: string) {
  return act((api, pid) => api.deleteExpense(pid, expenseId));
}

export async function uploadReceiptAction(form: FormData) {
  const { api, propertyId } = await authed();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, message: "영수증 사진을 골라 주세요." };
  try {
    const r = await api.uploadReceipt(propertyId, file);
    return {
      ok: true as const,
      data: {
        id: r.id,
        vendor: r.reading.vendor,
        date: r.reading.date,
        amount: r.reading.amount,
        category: r.reading.category ? (r.reading.category.toLowerCase() as ExpenseInput["category"]) : null,
      },
    };
  } catch (e) {
    return fail(e);
  }
}

export async function registerReceiptAction(receiptId: string, input: ExpenseInput) {
  return act((api, pid) => api.registerReceipt(pid, receiptId, toExpenseBody(input)));
}

export async function addOrderAction(input: {
  item: string;
  qty: number;
  unit: string;
  vendor: string;
  amount: number;
}) {
  return act((api, pid) => api.createOrder(pid, input));
}

export async function setOrderStatusAction(orderId: string, status: "ordered" | "received" | "cancelled") {
  return act((api, pid) => api.setOrderStatus(pid, orderId, upper(status)));
}

/* ── 설정 (F0-02 · F0-03 · F0-08 · F0-09 · F0-13) ── */

export async function savePropertyAction(input: { name: string; address: string; rooms: number; phone: string }) {
  return act((api, pid) =>
    api.updateProperty(pid, {
      name: input.name,
      address: input.address,
      rooms: input.rooms,
      phone: input.phone || undefined,
    }),
  );
}

export async function inviteAction(phone: string, role: "manager" | "staff") {
  return act((api, pid) => api.invite(pid, phone, upper(role)));
}

export async function changeRoleAction(memberId: string, role: "manager" | "staff") {
  return act((api, pid) => api.changeMemberRole(pid, memberId, upper(role)));
}

export async function readAllNotificationsAction() {
  return act((api, pid) => api.readAllNotifications(pid));
}

export async function setPlanAction(planId: string, enabled: boolean) {
  return act((api, pid) => api.setPlan(pid, upper(planId) as ApiPlanCode, enabled));
}

/** 개발용 PG: 실제 연동 때는 PG 결제창에서 받은 authKey 를 넘긴다 */
export async function registerCardAction() {
  return act((api, pid) => api.setCard(pid, `dev-${Date.now()}`));
}

export async function saveNoticesAction(items: Parameters<SettingsActions["saveNotices"]>[0]) {
  return act((api, pid) =>
    api.setNoticeSettings(
      pid,
      items.map((i) => ({ ...i, kind: upper(i.kind) })),
    ),
  );
}

/** 근로계약서 서명 — 로그인 없이 문자 링크의 토큰으로 (F5-06) */
export async function signContractAction(token: string, name: string): Promise<ActionResult<{ status: string }>> {
  try {
    const r = await (await serverApi()).signContract(token, name);
    return { ok: true, data: { status: r.status } };
  } catch (e) {
    return fail(e);
  }
}

/** 직원 본인 출근·퇴근 (F5-02) */
export async function clockAction(employeeId: string, action: "in" | "out") {
  return act((api, pid) => api.clock(pid, employeeId, action));
}

/* ── 현장 업무 (F7) — 직원도 쓰는 동작 ── */

export async function setRoomStatusAction(roomId: string, status: RoomStatus, memo?: string) {
  return act((api, pid) => api.setRoomStatus(pid, roomId, toApiRoomStatus(status), memo));
}

export async function addRoomsAction(rooms: Parameters<OpsActions["addRooms"]>[0]) {
  return act((api, pid) => api.addRooms(pid, [...rooms]));
}

export async function roomLogsAction(roomId: string): Promise<ActionResult<RoomLog[]>> {
  const { api, propertyId } = await authed();
  try {
    return { ok: true, data: (await api.roomLogs(propertyId, roomId)).map(toRoomLog) };
  } catch (e) {
    return fail(e);
  }
}

export async function addNoteAction(input: Parameters<OpsActions["addNote"]>[0]) {
  return act((api, pid) =>
    api.addOpsNote(pid, {
      kind: input.kind === "notice" ? "NOTICE" : "HANDOVER",
      body: input.body,
      shift: input.shift ? upper(input.shift) : undefined,
      pinned: input.pinned,
    }),
  );
}

export async function readNoteAction(noteId: string) {
  return act((api, pid) => api.readOpsNote(pid, noteId));
}

export async function pinNoteAction(noteId: string, pinned: boolean) {
  return act((api, pid) => api.pinOpsNote(pid, noteId, pinned));
}

export async function removeNoteAction(noteId: string) {
  return act((api, pid) => api.removeOpsNote(pid, noteId));
}
