import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { isLiveApi } from "@/infrastructure";
import { safeAppPath } from "@/shared";
import { COOKIE, serverApi } from "../../_lib/session";

/** 로그아웃 — 서버의 리프레시 토큰도 폐기. ?next= 가 있으면 로그인 뒤 그리로 */
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const refresh = jar.get(COOKIE.refresh)?.value;
  if (isLiveApi && refresh) await (await serverApi()).logout(refresh).catch(() => undefined);
  for (const name of Object.values(COOKIE)) jar.delete(name);
  const next = safeAppPath(req.nextUrl.searchParams.get("next"), "");
  const to = next ? `/app/login?next=${encodeURIComponent(next)}` : "/app/login";
  return NextResponse.redirect(new URL(to, req.url), 303);
}
