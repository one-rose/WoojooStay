import { NextResponse, type NextRequest } from "next/server";
import { isLiveApi } from "@/infrastructure";
import { readSession, serverApi } from "../../_lib/session";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 그대로 흘려보낼 API 응답 머리글 — 토큰·쿠키 같은 것은 넘기지 않는다 */
const PASS = ["content-type", "content-length", "content-disposition"] as const;

/**
 * 영수증 사진 보기 (F6-03) — /app/receipts/:id
 * 로그인 쿠키의 토큰으로 API(GET receipts/:id/file)를 대신 불러 파일만 돌려준다.
 * 토큰은 서버에만 있고 브라우저에는 파일만 간다. 지금 고른 업장의 영수증만 열린다(API 가 업장·권한 확인).
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/app/receipts/[id]">) {
  const { id } = await ctx.params;
  if (!isLiveApi || !ID.test(id)) return new NextResponse("영수증을 찾을 수 없어요.", { status: 404 });
  const s = await readSession();
  const here = `/app/receipts/${id}`;
  if (!s.accessToken) {
    // 리프레시 토큰이 있으면 갱신 후 다시 이 주소로
    const to = s.refreshToken ? `/app/session/refresh?next=${encodeURIComponent(here)}` : "/app/login";
    return NextResponse.redirect(new URL(to, req.url), 303);
  }
  if (!s.propertyId) return new NextResponse("업장을 먼저 골라 주세요.", { status: 400 });
  let res: Response;
  try {
    res = await (await serverApi(s.accessToken)).receiptFile(s.propertyId, id);
  } catch {
    return new NextResponse("서버와 연결하지 못했어요. 잠시 후 다시 시도해 주세요.", { status: 502 });
  }
  if (res.status === 401)
    return NextResponse.redirect(
      new URL(`/app/session/refresh?next=${encodeURIComponent(here)}&stale=1`, req.url),
      303,
    );
  if (!res.ok || !res.body) {
    const text = res.status === 403 ? "이 영수증을 볼 권한이 없어요." : "영수증을 찾을 수 없어요.";
    return new NextResponse(text, {
      status: res.status === 403 ? 403 : 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const headers = new Headers({
    // 브라우저가 내용을 짐작해 HTML 로 열지 않게 · 캐시에 남기지 않게 (파일 종류는 API 가 내용으로 확인한 값)
    "x-content-type-options": "nosniff",
    "cache-control": "private, no-store",
  });
  for (const h of PASS) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new NextResponse(res.body, { status: 200, headers });
}
