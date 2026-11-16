import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE } from "../_lib/session";

/** 운영자 로그아웃 — 토큰은 8시간 뒤 스스로 만료되므로 쿠키만 지운다 */
export async function POST(req: NextRequest) {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  return NextResponse.redirect(new URL("/admin/login", req.url), 303);
}
