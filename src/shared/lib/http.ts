/** 요청 머리글에서 실제 사용자 IP — x-forwarded-for 첫 번째 값, 없으면 x-real-ip */
export function clientIpFrom(get: (name: string) => string | null | undefined): string | undefined {
  const xff = get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  if (first) return first;
  return get("x-real-ip")?.trim() || undefined;
}

/** 내부 이동 경로만 허용 (열린 리다이렉트 방지) — "/app…" 이 아니면 fallback */
export function safeAppPath(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/app") || next.startsWith("//") || next.includes("\\")) return fallback;
  if (next.startsWith("/app/session") || next.startsWith("/app/login")) return fallback;
  return next;
}
