import { NextResponse, type NextRequest } from "next/server";
import { isLiveApi } from "@/infrastructure";
import { readSession, serverApi } from "../../_lib/session";

/**
 * 토스페이먼츠 카드 등록 창이 돌려보내는 주소 (F0-09)
 * 성공: ?authKey=…&customerKey=… → 서버에서 빌링키로 바꿔 저장 · 실패: ?fail=1&message=…
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const back = (params: Record<string, string>) =>
    NextResponse.redirect(new URL(`/app/settings/billing?${new URLSearchParams(params)}`, req.url), 303);
  if (!isLiveApi) return back({});
  // 화면에는 정해진 문구만 — 주소의 message 는 쓰지 않는다
  if (q.get("fail")) return back({ cardError: /CANCEL/i.test(q.get("code") ?? "") ? "cancel" : "failed" });

  const s = await readSession();
  if (!s.accessToken) return NextResponse.redirect(new URL("/app/login", req.url), 303);
  const authKey = q.get("authKey");
  // 다른 업장으로 받은 인증이 섞이지 않도록 지금 고른 업장과 맞는지 확인
  if (!authKey || !s.propertyId || q.get("customerKey") !== s.propertyId) return back({ cardError: "mismatch" });
  try {
    await (await serverApi(s.accessToken)).setCard(s.propertyId, authKey);
    return back({ card: "ok" });
  } catch {
    return back({ cardError: "failed" });
  }
}
