import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/infrastructure";
import { safeAppPath } from "@/shared";
import { COOKIE, cookieOptions, serverApi } from "../../_lib/session";

/**
 * 액세스 토큰 갱신 — 보통은 src/proxy.ts 가 요청 앞단에서 처리하고,
 * 여기는 화면에서 401 을 만났을 때의 마지막 확인용. ?next= 로 원래 화면으로 돌아간다.
 */
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const refresh = jar.get(COOKIE.refresh)?.value;
  const next = safeAppPath(req.nextUrl.searchParams.get("next"));
  const login = () => NextResponse.redirect(new URL(`/app/login?next=${encodeURIComponent(next)}`, req.url));
  // 다른 요청이 이미 새 토큰을 받아 두었으면 그대로 돌아간다
  // (?stale=1: 화면이 지금 토큰으로 401 을 받았다 — 그 토큰은 믿지 않는다)
  if (jar.get(COOKIE.access)?.value && !req.nextUrl.searchParams.has("stale"))
    return NextResponse.redirect(new URL(next, req.url));
  if (!refresh) return login();
  try {
    const t = await (await serverApi()).refresh(refresh);
    jar.set(COOKIE.access, t.accessToken, cookieOptions(Math.max(60, t.expiresIn - 30)));
    jar.set(COOKIE.refresh, t.refreshToken, cookieOptions(30 * 86_400));
    return NextResponse.redirect(new URL(next, req.url));
  } catch (e) {
    // 서버가 잠깐 안 될 때는 로그인 정보를 지우지 않는다
    if (!(e instanceof ApiError) || e.status >= 500) {
      return new NextResponse("서버와 연결하지 못했어요. 잠시 후 새로고침해 주세요.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "5" },
      });
    }
    jar.delete(COOKIE.access);
    jar.delete(COOKIE.refresh);
    return login();
  }
}
