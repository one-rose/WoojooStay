import { createHmac, timingSafeEqual } from 'node:crypto';

/** 출근 반경 기본값·범위 (m) */
export const CLOCK_RADIUS = { default: 150, min: 50, max: 1000 } as const;
/** 위치 정확도는 이만큼까지만 봐준다 (정확도가 1km 라고 1km 밖에서 출근되지 않게) */
export const MAX_ACCURACY_CREDIT_M = 100;
/** QR 서명 길이 (바이트) — base64url 24글자 */
const SIG_BYTES = 18;

/** 앱·화면에 내려주는 출근 확인 설정 — 위치는 위도·경도가 둘 다 있을 때만 */
export function clockSettings(p: { latitude: number | null; longitude: number | null; clockRadiusM: number }) {
  const locationSet = p.latitude !== null && p.longitude !== null;
  return {
    locationSet,
    latitude: locationSet ? p.latitude : null,
    longitude: locationSet ? p.longitude : null,
    radiusM: p.clockRadiusM,
  };
}

/** 두 좌표 사이 거리 (m, 하버사인) */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_008.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 반경 안인지 — 휴대폰 위치는 정확도(m)만큼 틀릴 수 있어 (거리 − min(정확도, 100m)) ≤ 반경 이면 안으로 본다.
 * 정확도가 없으면 0 으로 본다.
 */
export function withinRadius(distance: number, radiusM: number, accuracyM = 0): boolean {
  return distance - Math.min(Math.max(0, accuracyM), MAX_ACCURACY_CREDIT_M) <= radiusM;
}

const sign = (secret: string, propertyId: string, keyVersion: number) =>
  createHmac('sha256', secret)
    .update(`${propertyId}:${keyVersion}`)
    .digest()
    .subarray(0, SIG_BYTES)
    .toString('base64url');

/** 출근 QR 내용 — 인쇄해서 프런트에 붙이는 고정 QR (회전하지 않음, 키 번호를 올리면 예전 QR 은 무효) */
export function clockQrPayload(secret: string, propertyId: string, keyVersion: number): string {
  return `uzustay://clock?p=${propertyId}&k=${keyVersion}&s=${sign(secret, propertyId, keyVersion)}`;
}

export type QrCheck =
  | { ok: true; propertyId: string; keyVersion: number }
  | { ok: false; reason: 'INVALID' | 'OTHER_PROPERTY' | 'OLD_VERSION' };

/**
 * QR 확인 — 서명이 맞는지(INVALID), 이 업장 것인지(OTHER_PROPERTY), 지금 키 번호인지(OLD_VERSION).
 * 앱은 찍은 문자열을 그대로 보낸다.
 */
export function verifyClockQr(secret: string, raw: string, propertyId: string, currentVersion: number): QrCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'INVALID' };
  }
  if (url.protocol !== 'uzustay:' || url.host !== 'clock') return { ok: false, reason: 'INVALID' };
  const p = url.searchParams.get('p') ?? '';
  const kRaw = url.searchParams.get('k') ?? '';
  const s = url.searchParams.get('s') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(p) || !/^[1-9]\d{0,8}$/.test(kRaw) || !s) return { ok: false, reason: 'INVALID' };
  const k = Number(kRaw);
  const want = Buffer.from(sign(secret, p.toLowerCase(), k));
  const got = Buffer.from(s);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, reason: 'INVALID' };
  if (p.toLowerCase() !== propertyId.toLowerCase()) return { ok: false, reason: 'OTHER_PROPERTY' };
  if (k !== currentVersion) return { ok: false, reason: 'OLD_VERSION' };
  return { ok: true, propertyId: p, keyVersion: k };
}
