const krNumber = new Intl.NumberFormat("ko-KR");

/** 4820000 → "4,820,000" */
export function formatNumber(value: number): string {
  return krNumber.format(value);
}

/** 2740000 → "2.74M" (백만 단위, 소수 둘째 자리) */
export function formatMillions(value: number): string {
  return `${(value / 1_000_000).toFixed(2)}M`;
}

/** 입력 중인 휴대폰 번호에 하이픈 — "01012345678" → "010-1234-5678" (지우는 중에도 자연스럽게) */
export function formatPhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.startsWith("02")) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/*
 * 말과 숫자 (docs/PMS-DESIGN-SYSTEM.md 7장)
 * - 요약 띠·합계: formatWon → "₩4,820,000"
 * - 표 칸: formatNumber 숫자만, 머리에 "(원)"
 * - 좁은 자리(차트 라벨·카드 한 줄): formatWonCompact → "9,101만"
 * - 시간: formatHours → "91시간", "161.5시간" (영문 h 쓰지 않음)
 */

/** 4820000 → "₩4,820,000", -3000 → "−₩3,000" */
export function formatWon(value: number): string {
  const n = Math.round(value);
  return n < 0 ? `−₩${krNumber.format(-n)}` : `₩${krNumber.format(n)}`;
}

/** 만 원 단위로 줄여 쓰기 — 91010000 → "9,101만", 3100000 → "310만", 8000 → "8,000원" */
export function formatWonCompact(value: number): string {
  const n = Math.round(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs < 10_000) return `${sign}${krNumber.format(abs)}원`;
  return `${sign}${krNumber.format(Math.round(abs / 10_000))}만`;
}

/** 91 → "91시간", 161.94 → "161.9시간", 0 → "0시간" */
export function formatHours(value: number): string {
  const r = Math.round(value * 10) / 10;
  return `${Number.isInteger(r) ? krNumber.format(r) : r.toFixed(1)}시간`;
}
