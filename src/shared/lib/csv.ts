/**
 * CSV 한 칸 — 엑셀이 수식으로 읽지 않게 (CSV 수식 주입 방지).
 * 글자 칸이 = + - @ 탭 CR 로 시작하면 앞에 ' 를 붙인다. 숫자 칸(number)은 음수여도 그대로.
 * 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다.
 */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
