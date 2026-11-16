import { billingOrderPrefix } from '../billing/billing.service.js';
import { exposeDevSecrets, validateEnv, webOrigin } from '../config/env.js';
import { CHANNEL_CATALOG } from '../connectors/catalog.js';
import { sniffReceiptType } from '../expenses/expenses.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { mapPrismaError } from './errors/prisma-exception.filter.js';
import { clientTracker } from './guards/client-throttler.guard.js';
import { prevToDateEnd } from './utils/dates.js';
import { isCalendarDate, isMonth } from './validation/date-fields.js';

const KEY = 'k'.repeat(40);
const baseEnv = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  CREDENTIALS_KEY: Buffer.alloc(32).toString('base64'),
};

describe('요청 제한 기준 IP (화면 서버 ↔ API)', () => {
  it('내부 키가 맞을 때만 x-client-ip 를 믿는다', () => {
    const headers = { 'x-internal-key': KEY, 'x-client-ip': '203.0.113.7' };
    expect(clientTracker({ ip: '10.0.0.2', headers }, KEY)).toBe('203.0.113.7');
    expect(clientTracker({ ip: '10.0.0.2', headers: { ...headers, 'x-internal-key': 'x'.repeat(40) } }, KEY)).toBe(
      '10.0.0.2',
    );
    expect(clientTracker({ ip: '10.0.0.2', headers: { 'x-client-ip': '1.2.3.4' } }, KEY)).toBe('10.0.0.2');
    // 키를 설정하지 않았으면 헤더는 무시
    expect(clientTracker({ ip: '10.0.0.2', headers }, undefined)).toBe('10.0.0.2');
  });
});

describe('날짜 검증', () => {
  it('달력에 없는 날은 거절', () => {
    expect(isCalendarDate('2026-02-28')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-02-31')).toBe(false);
    expect(isCalendarDate('2026-13-45')).toBe(false);
    expect(isCalendarDate('2026-11-00')).toBe(false);
    expect(isCalendarDate('26-11-01')).toBe(false);
    expect(isMonth('2026-11')).toBe(true);
    expect(isMonth('2026-13')).toBe(false);
    expect(isMonth('0001-01')).toBe(false);
  });

  it('지난달 같은 날까지 — 이번 달이면 같은 날, 지난 달을 보면 전체', () => {
    expect(prevToDateEnd('2026-11', '2026-11-16').toISOString().slice(0, 10)).toBe('2026-10-17');
    // 3월 31일 → 2월은 28일까지
    expect(prevToDateEnd('2026-03', '2026-03-31').toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(prevToDateEnd('2026-10', '2026-11-16').toISOString().slice(0, 10)).toBe('2026-10-01');
  });
});

describe('DB 오류 → 응답', () => {
  const known = (code: string) => new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: '7' });
  it('중복 409 · 없음 404 · 형식 400', () => {
    expect(mapPrismaError(known('P2002'))?.getResponse()).toMatchObject({ statusCode: 409, errorCode: 'CONFLICT' });
    expect(mapPrismaError(known('P2025'))?.getStatus()).toBe(404);
    expect(mapPrismaError(known('P2007'))?.getResponse()).toMatchObject({ statusCode: 400, errorCode: 'BAD_INPUT' });
    expect(mapPrismaError(known('P1001'))).toBeNull();
    expect(mapPrismaError(new Error('x'))).toBeNull();
  });
});

describe('운영 환경 변수', () => {
  it('운영에서 결제·문자 키가 없으면 시작하지 않는다 (일부러 허용하면 시작)', () => {
    expect(() => validateEnv({ ...baseEnv, NODE_ENV: 'production' })).toThrow(/TOSS_SECRET_KEY.*ALIGO_API_KEY/s);
    expect(() => validateEnv({ ...baseEnv, NODE_ENV: 'production', ALLOW_FAKE_INTEGRATIONS: 'true' })).not.toThrow();
    expect(() =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        TOSS_SECRET_KEY: 'live_sk',
        ALIGO_API_KEY: 'k',
        ALIGO_USER_ID: 'u',
        SMS_SENDER: '0212345678',
      }),
    ).not.toThrow();
    expect(validateEnv({ ...baseEnv }).TRIAL_DAYS).toBe(30);
    expect(validateEnv({ ...baseEnv, TRIAL_DAYS: '56' }).TRIAL_DAYS).toBe(56);
    expect(() => validateEnv({ ...baseEnv, INTERNAL_API_KEY: 'short' })).toThrow(/INTERNAL_API_KEY/);
  });

  it('운영에서는 인증번호·토큰을 응답에 넣지 않는다', () => {
    expect(exposeDevSecrets('production')).toBe(false);
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(exposeDevSecrets('development')).toBe(false);
    process.env.NODE_ENV = prev;
    expect(exposeDevSecrets('test')).toBe(true);
  });

  it('문자 링크는 첫 번째 화면 주소로', () => {
    expect(webOrigin('https://woojoo.kr/, https://www.woojoo.kr')).toBe('https://woojoo.kr');
  });
});

describe('채널 답글 방식', () => {
  it('공식 답글 API 가 확인된 호텔스닷컴(Expedia)만 API', () => {
    const api = Object.entries(CHANNEL_CATALOG)
      .filter(([, c]) => c.replyMode === 'API')
      .map(([k]) => k);
    expect(api).toEqual(['HOTELS']);
  });
});

describe('영수증 파일 형식 (첫 바이트로 확인)', () => {
  it('사진·PDF 시그니처', () => {
    expect(sniffReceiptType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffReceiptType(Buffer.from('89504e470d0a1a0a0000', 'hex'))).toBe('image/png');
    expect(sniffReceiptType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1'))).toBe('image/webp');
    expect(sniffReceiptType(Buffer.from('\0\0\0\x18ftypheic\0\0', 'latin1'))).toBe('image/heic');
    expect(sniffReceiptType(Buffer.from('%PDF-1.7'))).toBe('application/pdf');
    expect(sniffReceiptType(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
  });
});

describe('PG 주문번호(멱등 키)', () => {
  it('토스 규칙 6~64자 [A-Za-z0-9_=-] 안에 들어간다', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const key = `${billingOrderPrefix(id, '2026-11', 'EXPENSE')}12`;
    expect(key).toMatch(/^[A-Za-z0-9_=-]{6,64}$/);
    expect(billingOrderPrefix(id, '2026-11', 'M')).toBe(billingOrderPrefix(id, '2026-11', 'M'));
  });
});

describe('빈 내부 키', () => {
  it('INTERNAL_API_KEY= (빈 값) 은 없는 것으로', () => {
    expect(validateEnv({ ...baseEnv, INTERNAL_API_KEY: '' }).INTERNAL_API_KEY).toBeUndefined();
  });
});
