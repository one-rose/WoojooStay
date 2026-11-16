import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isLiveApi } from "@/infrastructure";

/** 운영자 토큰 — 사장님 앱 쿠키(uz_at)와 이름·경로를 나눈다 */
export const ADMIN_COOKIE = "uz_admin";

export const adminCookieOptions = (maxAgeSec: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/admin",
  maxAge: maxAgeSec,
});

/** 실서버 모드에서 운영자 토큰을 꺼낸다. 없으면 로그인으로. 예시 모드면 null */
export async function requireAdminToken(): Promise<string | null> {
  if (!isLiveApi) return null;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) redirect("/admin/login");
  return token;
}
