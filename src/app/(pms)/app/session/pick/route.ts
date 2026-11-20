import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { ApiAuthError, ApiError, isLiveApi } from "@/infrastructure";
import { safeAppPath } from "@/shared";
import { COOKIE, cookieOptions, serverApi } from "../../_lib/session";

/**
 * 업장 다시 고르기 — 업장 쿠키(uz_pid)가 없거나 내 업장 목록에 없을 때 화면이 여기로 보낸다
 * (사장님이 나를 그 업장에서 뺐을 때 등). 쿠키는 route handler 에서만 고칠 수 있다.
 *
 * - 쿠키 업장이 아직 내 업장이면 그대로 ?next= 로
 * - 사장님·매니저인 업장 2곳 이상 → 전체 현황, 1곳 → 그 업장 홈
 * - 직원으로만 속해 있으면 → 출퇴근 화면
 * - 하나도 없으면 → 시작하기(온보딩)
 *
 * 맴돌지 않게: 여기서는 늘 새로 불러온 내 업장 목록 안에서만 고르고,
 * 화면은 쿠키 업장이 그 목록에 없을 때만 여기로 보낸다. next 로 /app/session… 은 받지 않는다.
 */
export async function GET(req: NextRequest) {
  const next = safeAppPath(req.nextUrl.searchParams.get("next"));
  const go = (path: string) => NextResponse.redirect(new URL(path, req.url));
  if (!isLiveApi) return go(next);

  const jar = await cookies();
  const access = jar.get(COOKIE.access)?.value;
  if (!access) {
    return jar.get(COOKIE.refresh)?.value
      ? go(`/app/session/refresh?next=${encodeURIComponent(next)}`)
      : go(`/app/login?next=${encodeURIComponent(next)}`);
  }

  let me;
  try {
    me = await (await serverApi(access)).me();
  } catch (e) {
    if (e instanceof ApiAuthError) return go(`/app/session/refresh?next=${encodeURIComponent(next)}&stale=1`);
    if (!(e instanceof ApiError) || e.status >= 500) {
      return new NextResponse("서버와 연결하지 못했어요. 잠시 후 새로고침해 주세요.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "5" },
      });
    }
    throw e;
  }

  const current = jar.get(COOKIE.property)?.value;
  if (current && me.properties.some((p) => p.id === current)) return go(next);

  const keep = (id: string) => jar.set(COOKIE.property, id, cookieOptions(30 * 86_400));
  const managed = me.properties.filter((p) => p.role !== "STAFF");
  if (managed.length > 0) {
    keep(managed[0].id);
    return go(managed.length >= 2 ? "/app/overview" : "/app");
  }
  if (me.properties.length > 0) {
    keep(me.properties[0].id);
    return go("/app/me");
  }
  jar.delete(COOKIE.property);
  return go("/app/onboarding");
}
