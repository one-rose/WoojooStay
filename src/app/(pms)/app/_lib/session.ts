import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { PmsRepository } from "@/core";
import { cache } from "react";
import { ApiAuthError, demoPmsRepository, isLiveApi, livePmsRepository, pmsApi } from "@/infrastructure";
import { clientIpFrom, safeAppPath } from "@/shared";

/** 로그인 정보는 httpOnly 쿠키에만 둔다 (브라우저 스크립트에서 못 읽음) */
export const COOKIE = {
  access: "uz_at",
  refresh: "uz_rt",
  property: "uz_pid",
  onboarding: "uz_onb",
  /** 토스 카드 등록 창 확인값 (등록 시작 → 돌아올 때 대조, 15분) */
  card: "uz_card",
} as const;

/** src/proxy.ts 가 넣어 주는 지금 경로 (갱신 후 돌아올 곳) */
const PATH_HEADER = "x-uz-path";

export const cookieOptions = (maxAgeSec: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: maxAgeSec,
});

export async function readSession() {
  const jar = await cookies();
  return {
    accessToken: jar.get(COOKIE.access)?.value,
    refreshToken: jar.get(COOKIE.refresh)?.value,
    propertyId: jar.get(COOKIE.property)?.value,
  };
}

/** 실제 사용자 IP — API 서버의 요청 제한·기록용 */
export async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  return clientIpFrom((n) => h.get(n));
}

/** API 호출기 (토큰이 있으면 붙이고, 사용자 IP 는 항상) */
export async function serverApi(token?: string) {
  return pmsApi(token, await clientIp());
}

/** 지금 경로 — proxy 가 넣은 머리글 (없으면 /app) */
async function currentPath(): Promise<string> {
  const h = await headers();
  return safeAppPath(h.get(PATH_HEADER));
}

/** 토큰 갱신 경로로 — 끝나면 지금 화면으로 돌아온다 */
export async function redirectToRefresh(opts: { next?: string; stale?: boolean } = {}): Promise<never> {
  const back = opts.next ?? (await currentPath());
  redirect(`/app/session/refresh?next=${encodeURIComponent(back)}${opts.stale ? "&stale=1" : ""}`);
}

/** 로그인 확인 — 토큰이 없으면 갱신(리프레시 토큰이 있을 때) 또는 로그인으로 */
export async function requireSession() {
  const s = await readSession();
  if (!s.accessToken) {
    if (s.refreshToken) await redirectToRefresh();
    redirect("/app/login");
  }
  return s as typeof s & { accessToken: string };
}

/** 저장소 메서드에서 토큰 만료(401)가 나면 화면을 깨뜨리지 말고 갱신 경로로 */
function guardAuth<T extends object>(target: T): T {
  return new Proxy(target, {
    get(obj, key, receiver) {
      const value = Reflect.get(obj, key, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const out = value.apply(obj, args);
        if (!(out instanceof Promise)) return out;
        return out.catch(async (e: unknown) => {
          if (e instanceof ApiAuthError) await redirectToRefresh({ stale: true });
          throw e;
        });
      };
    },
  });
}

/**
 * 화면 데이터 저장소
 * - PMS_API_URL 없음: 예시 데이터 (쿠키를 읽지 않으므로 정적 생성 그대로)
 * - 있음: 로그인 확인 → 실서버 저장소. 토큰이 없으면 로그인, 고른 업장이 없거나 내 업장이 아니면 다시 고르기로.
 */
export async function getRepository(): Promise<PmsRepository> {
  if (!isLiveApi) {
    // 체험 모드 — 날짜를 오늘 기준으로 옮기므로 빌드 때 굳히지 않고 요청마다 그린다.
    // 업장 전환(예시 업장 10곳)은 같은 업장 쿠키로 — 고른 업장 이름·객실 수로 보인다
    await connection();
    return demoPmsRepository((await cookies()).get(COOKIE.property)?.value);
  }
  const s = await requireSession();
  // 업장 쿠키가 없거나, 그 업장에서 빠졌으면(사장님이 내보냄 등) 남은 업장으로 다시 고른다
  const propertyId = s.propertyId;
  if (!propertyId || !(await isMyProperty(s.accessToken, propertyId))) return redirectToPick();
  return guardAuth(livePmsRepository(s.accessToken, propertyId, await clientIp()));
}

/** 로그인한 사람과 속한 업장 — 한 요청 안에서는 한 번만 부른다 (레이아웃 · 화면 · 전환 목록) */
export const loadMe = cache(async (accessToken: string) => (await serverApi(accessToken)).me());

/**
 * 업장 다시 고르기 — 쿠키는 서버 컴포넌트에서 못 바꾸므로 route handler 로 보낸다.
 * 거기서 내 업장 목록을 새로 불러 남은 업장(없으면 온보딩)으로 쿠키를 고친다.
 */
export async function redirectToPick(): Promise<never> {
  redirect(`/app/session/pick?next=${encodeURIComponent(await currentPath())}`);
}

/**
 * 고른 업장이 아직 내 업장(사장님·매니저·직원)인지.
 * fresh: 이 요청에서 부른 목록(loadMe)을 쓰지 않고 새로 묻는다 — API 가 404 를 준 뒤 확인할 때.
 * 목록을 못 불러오면(서버가 잠깐 안 됨) 막지 않는다 — 다시 고르기와 오가며 맴돌지 않게.
 */
export async function isMyProperty(accessToken: string, propertyId: string, fresh = false): Promise<boolean> {
  const load = fresh ? serverApi(accessToken).then((api) => api.me()) : loadMe(accessToken);
  const me = await load.catch(async (e: unknown) => {
    if (e instanceof ApiAuthError) await redirectToRefresh({ stale: true });
    return null;
  });
  return !me || me.properties.some((p) => p.id === propertyId);
}
