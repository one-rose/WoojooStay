const krNumber = new Intl.NumberFormat("ko-KR");

/** 4820000 → "4,820,000" */
export function formatNumber(value: number): string {
  return krNumber.format(value);
}

/** 2740000 → "2.74M" (백만 단위, 소수 둘째 자리) */
export function formatMillions(value: number): string {
  return `${(value / 1_000_000).toFixed(2)}M`;
}
