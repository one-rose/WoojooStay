import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { isLiveApi } from "@/infrastructure";
import { COOKIE, readSession, serverApi } from "../../_lib/session";

/** 등록 시작 때 쿠키에 둔 확인값과 돌아온 주소의 ?state= 가 같은지 (같은 업장으로 시작했는지도) */
function sameState(cookie: string | undefined, state: string | null, propertyId: string): boolean {
  if (!cookie || !state) return false;
  const expected = Buffer.from(`${state}.${propertyId}`);
  const got = Buffer.from(cookie);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/**
 * 토스페이먼츠 카드 등록 창이 돌려보내는 주소 (F0-09)
 * 성공: ?authKey=…&customerKey=… → 서버에서 빌링키로 바꿔 저장 · 실패: ?fail=1&message=…
 * 등록을 시작한 브라우저인지 ?state= 와 httpOnly 쿠키(uz_card)를 맞춰 본다 — 남이 만든 결과 주소를 눌러도 저장되지 않게.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const back = (params: Record<string, string>) =>
    NextResponse.redirect(new URL(`/app/settings/billing?${new URLSearchParams(params)}`, req.url), 303);
  if (!isLiveApi) return back({});
  // 확인값은 한 번만 — 성공·실패 어느 쪽이든 지운다
  const jar = await cookies();
  const saved = jar.get(COOKIE.card)?.value;
  jar.delete(COOKIE.card);
  // 화면에는 정해진 문구만 — 주소의 message 는 쓰지 않는다
  if (q.get("fail")) return back({ cardError: /CANCEL/i.test(q.get("code") ?? "") ? "cancel" : "failed" });

  const s = await readSession();
  if (!s.accessToken) return NextResponse.redirect(new URL("/app/login", req.url), 303);
  const authKey = q.get("authKey");
  // 다른 업장으로 받은 인증이 섞이지 않도록 지금 고른 업장과 맞는지 확인
  if (!authKey || !s.propertyId || q.get("customerKey") !== s.propertyId) return back({ cardError: "mismatch" });
  if (!sameState(saved, q.get("state"), s.propertyId)) return back({ cardError: "mismatch" });
  try {
    await (await serverApi(s.accessToken)).setCard(s.propertyId, authKey);
    return back({ card: "ok" });
  } catch {
    return back({ cardError: "failed" });
  }
}
