import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError, isLiveApi } from "@/infrastructure";
import { safeAppPath } from "@/shared";
import { COOKIE, cookieOptions, serverApi } from "../_lib/session";

/** 코드 모양 — API 가 만드는 base64url 43자 (그 밖은 API 를 부르지 않고 거절) */
const CODE = /^[\w-]{20,100}$/;

const plain = (status: number, text: string) =>
  new NextResponse(text, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });

/**
 * 앱 → 웹 화면 넘기기. 앱이 POST /auth/web-handoff 로 받은 1회용 코드(60초)를 웹뷰에서
 * /app/handoff?code=… 로 열면, 여기서 API 로 바꿔 평소 로그인 쿠키를 굽고 그 화면(/app… 만)으로 보낸다.
 * 웹은 앱과 따로 된 새 로그인(새 리프레시 토큰)을 받는다.
 */
export async function GET(req: NextRequest) {
  if (!isLiveApi) return NextResponse.redirect(new URL("/app", req.url));
  const code = req.nextUrl.searchParams.get("code") ?? "";
  if (!CODE.test(code)) return plain(400, "화면을 여는 링크가 올바르지 않아요. 앱에서 다시 눌러 주세요.");
  try {
    const t = await (await serverApi()).exchangeHandoff(code);
    const jar = await cookies();
    jar.set(COOKIE.access, t.accessToken, cookieOptions(Math.max(60, t.expiresIn - 30)));
    jar.set(COOKIE.refresh, t.refreshToken, cookieOptions(30 * 86_400));
    if (t.propertyId) jar.set(COOKIE.property, t.propertyId, cookieOptions(30 * 86_400));
    const res = NextResponse.redirect(new URL(safeAppPath(t.path), req.url));
    res.headers.set("cache-control", "no-store");
    res.headers.set("referrer-policy", "no-referrer");
    return res;
  } catch (e) {
    if (e instanceof ApiError && e.status < 500)
      return plain(401, "화면을 여는 시간이 지났거나 이미 쓴 링크예요. 앱에서 다시 눌러 주세요.");
    return plain(503, "서버와 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
}
