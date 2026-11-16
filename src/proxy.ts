import { NextResponse, type NextRequest } from "next/server";
import { isLiveApi, pmsApi, type ApiTokens } from "@/infrastructure";
import { clientIpFrom } from "@/shared";

/**
 * 앱(/app) 요청 앞단 — 액세스 토큰 갱신을 한 곳에서 한 번만 한다.
 *
 * 액세스 토큰(uz_at)이 없거나 곧 만료되고 리프레시 토큰(uz_rt)이 있으면
 * API 에서 새 토큰을 받아 ① 응답 쿠키로 브라우저에 저장하고 ② 이번 요청의 쿠키에도 넣어
 * 서버 컴포넌트·서버 동작이 바로 새 토큰을 읽게 한다.
 * 리프레시 토큰은 1회용이라, 같은 토큰으로 동시에 들어온 요청(이동 + 미리 불러오기 등)은
 * 첫 갱신 결과를 함께 쓴다.
 */

const ACCESS = "uz_at";
const REFRESH = "uz_rt";
/** 화면 → 갱신 경로로 보낼 때 돌아올 주소 */
const PATH_HEADER = "x-uz-path";

const inflight = new Map<string, { at: number; result: Promise<ApiTokens | null> }>();

function refreshOnce(refreshToken: string, clientIp?: string): Promise<ApiTokens | null> {
  const now = Date.now();
  for (const [k, v] of inflight) if (now - v.at > 30_000) inflight.delete(k);
  const hit = inflight.get(refreshToken);
  if (hit) return hit.result;
  const result = pmsApi(undefined, clientIp)
    .refresh(refreshToken)
    .catch(() => null);
  inflight.set(refreshToken, { at: now, result });
  return result;
}

/** JWT exp 가 30초 안에 지나면 만료로 본다 (형식이 다르면 쿠키 유무로만 판단) */
function expiresSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return false;
  }
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, pathname + search);

  const skip = !isLiveApi || pathname.startsWith("/app/session") || pathname.startsWith("/app/contract");
  const access = request.cookies.get(ACCESS)?.value;
  const refresh = request.cookies.get(REFRESH)?.value;
  if (skip || !refresh || (access && !expiresSoon(access))) {
    return NextResponse.next({ request: { headers } });
  }

  const tokens = await refreshOnce(
    refresh,
    clientIpFrom((n) => request.headers.get(n)),
  );
  if (!tokens) {
    // 실패해도 여기서 쿠키를 지우지 않는다 — 동시에 들어온 다른 요청이 이미 새 토큰을 받았을 수 있다.
    // 화면 쪽이 /app/session/refresh 로 한 번 더 확인하고, 그래도 안 되면 로그인으로 보낸다.
    return NextResponse.next({ request: { headers } });
  }

  // 이번 요청에도 새 토큰을 넣는다
  const jar = request.cookies.getAll().filter((c) => c.name !== ACCESS && c.name !== REFRESH);
  jar.push({ name: ACCESS, value: tokens.accessToken }, { name: REFRESH, value: tokens.refreshToken });
  headers.set("cookie", jar.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join("; "));

  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(ACCESS, tokens.accessToken, cookieOptions(Math.max(60, tokens.expiresIn - 30)));
  res.cookies.set(REFRESH, tokens.refreshToken, cookieOptions(30 * 86_400));
  return res;
}

export const config = {
  matcher: ["/app", "/app/:path*"],
};
