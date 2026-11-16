/**
 * 사업자등록번호 검증번호(체크섬) 확인 — 국세청 공개 규칙
 * 실제 휴·폐업 여부는 BizVerifier(국세청 API)로 따로 확인한다.
 */
export function isValidBizNo(raw: string): boolean {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 10) return false;
  const n = d.split('').map(Number);
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += n[i] * w[i];
  sum += Math.floor((n[8] * 5) / 10);
  return (10 - (sum % 10)) % 10 === n[9];
}
