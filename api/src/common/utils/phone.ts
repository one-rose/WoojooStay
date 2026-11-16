/** "010-1234-5678" → "01012345678". 한국 휴대폰 번호만 허용 */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export const KOREAN_MOBILE = /^01[016789]\d{7,8}$/;

/** "01012345678" → "010-****-5678" */
export function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}-****-${phone.slice(-4)}`;
}
