import { clockQrPayload, clockSettings, distanceM, verifyClockQr, withinRadius } from './clock-presence.js';

const SECRET = 'test-secret-test-secret-test-secret-123';
const PID = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';

describe('출근 위치 확인', () => {
  it('하버사인 거리 — 서울시청 ↔ 을지로입구역 쪽 약 380m', () => {
    const d = distanceM({ lat: 37.5663, lng: 126.9779 }, { lat: 37.566, lng: 126.9822 });
    expect(d).toBeGreaterThan(350);
    expect(d).toBeLessThan(400);
    expect(distanceM({ lat: 37.5, lng: 127 }, { lat: 37.5, lng: 127 })).toBe(0);
  });

  it('(거리 − min(정확도, 100m)) ≤ 반경', () => {
    expect(withinRadius(150, 150)).toBe(true);
    expect(withinRadius(151, 150)).toBe(false);
    expect(withinRadius(200, 150, 60)).toBe(true);
    expect(withinRadius(200, 150, 40)).toBe(false);
    // 정확도는 100m 까지만 봐준다
    expect(withinRadius(260, 150, 5000)).toBe(false);
    expect(withinRadius(250, 150, 5000)).toBe(true);
    expect(withinRadius(150, 150, -20)).toBe(true);
  });

  it('업장 위치는 위도·경도가 둘 다 있을 때만', () => {
    expect(clockSettings({ latitude: null, longitude: null, clockRadiusM: 150 })).toEqual({
      locationSet: false,
      latitude: null,
      longitude: null,
      radiusM: 150,
    });
    expect(clockSettings({ latitude: 37.5, longitude: null, clockRadiusM: 200 }).locationSet).toBe(false);
    expect(clockSettings({ latitude: 37.5, longitude: 127, clockRadiusM: 200 }).locationSet).toBe(true);
  });
});

describe('출근 QR', () => {
  const qr = clockQrPayload(SECRET, PID, 3);

  it('uzustay://clock?p=&k=&s= 모양, 서명 24글자', () => {
    expect(qr).toMatch(/^uzustay:\/\/clock\?p=[0-9a-f-]{36}&k=3&s=[\w-]{24}$/);
    expect(verifyClockQr(SECRET, qr, PID, 3)).toEqual({ ok: true, propertyId: PID, keyVersion: 3 });
    expect(verifyClockQr(SECRET, `  ${qr}\n`, PID, 3).ok).toBe(true);
  });

  it('서명이 틀리면 INVALID · 다른 업장이면 OTHER_PROPERTY · 예전 키면 OLD_VERSION', () => {
    expect(verifyClockQr('another-secret-another-secret-123456', qr, PID, 3)).toEqual({ ok: false, reason: 'INVALID' });
    expect(verifyClockQr(SECRET, qr.replace(/s=.*/, 's=AAAAAAAAAAAAAAAAAAAAAAAA'), PID, 3)).toEqual({
      ok: false,
      reason: 'INVALID',
    });
    // 업장 id 만 바꾸면 서명이 안 맞는다
    expect(verifyClockQr(SECRET, qr.replace(PID, OTHER), OTHER, 3)).toEqual({ ok: false, reason: 'INVALID' });
    expect(verifyClockQr(SECRET, clockQrPayload(SECRET, OTHER, 1), PID, 3)).toEqual({
      ok: false,
      reason: 'OTHER_PROPERTY',
    });
    expect(verifyClockQr(SECRET, clockQrPayload(SECRET, PID, 2), PID, 3)).toEqual({ ok: false, reason: 'OLD_VERSION' });
    for (const bad of [
      '',
      'hello',
      'https://evil.example/clock?p=x',
      'uzustay://other?p=1',
      `uzustay://clock?p=${PID}&k=0&s=x`,
    ])
      expect(verifyClockQr(SECRET, bad, PID, 3).ok).toBe(false);
  });
});
