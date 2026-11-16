import { afterEach, describe, expect, it, vi } from 'vitest';
import { TossPaymentGateway } from '../billing/payment-gateway.js';
import { NtsBizVerifier } from '../properties/biz-verifier.js';
import { AligoSmsSender } from '../sms/sms-sender.js';

/** 외부 연동 구현 — 실제 서버 대신 fetch 를 흉내 내서 요청 모양과 응답 해석만 확인한다 */
const mockFetch = (status: number, body: unknown) => {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
};
const call = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[0] as unknown as [string, RequestInit];

afterEach(() => vi.unstubAllGlobals());

describe('NtsBizVerifier (국세청 상태조회)', () => {
  const bizNo = '1234567891'; // 검증번호가 맞는 번호
  it.each([
    ['01', 'ACTIVE'],
    ['02', 'CLOSED'],
    ['03', 'CLOSED'],
    ['', 'INVALID'],
  ])('b_stt_cd %s → %s', async (code, expected) => {
    const fn = mockFetch(200, { data: [{ b_no: bizNo, b_stt_cd: code }] });
    expect(await new NtsBizVerifier('key/+=').check(bizNo)).toBe(expected);
    const [url, init] = call(fn);
    expect(url).toContain('serviceKey=key%2F%2B%3D');
    expect(JSON.parse(init.body as string)).toEqual({ b_no: [bizNo] });
  });

  it('검증번호가 틀리면 조회하지 않고 INVALID', async () => {
    const fn = mockFetch(200, {});
    expect(await new NtsBizVerifier('k').check('1234567890')).toBe('INVALID');
    expect(fn).not.toHaveBeenCalled();
  });

  it('국세청 서버 오류면 가입을 막지 않는다', async () => {
    mockFetch(500, {});
    expect(await new NtsBizVerifier('k').check(bizNo)).toBe('ACTIVE');
  });
});

describe('AligoSmsSender (문자)', () => {
  const sms = new AligoSmsSender({ apiKey: 'k', userId: 'u', sender: '02-123-4567' });

  it('짧으면 SMS, 길면 LMS · 번호는 숫자만', async () => {
    const fn = mockFetch(200, { result_code: '1', message: 'success' });
    await sms.send('010-1111-2222', '인증번호 123456');
    const form = new URLSearchParams(call(fn)[1].body as string);
    expect(form.get('receiver')).toBe('01011112222');
    expect(form.get('sender')).toBe('021234567');
    expect(form.get('msg_type')).toBe('SMS');
    fn.mockClear();
    await sms.send('01011112222', '가'.repeat(40));
    expect(new URLSearchParams(call(fn)[1].body as string).get('msg_type')).toBe('LMS');
  });

  it('실패 코드면 오류', async () => {
    mockFetch(200, { result_code: -101, message: '인증오류' });
    await expect(sms.send('01011112222', 'x')).rejects.toThrow('인증오류');
  });
});

describe('TossPaymentGateway (정기결제)', () => {
  const pg = new TossPaymentGateway('test_sk_abc');

  it('authKey → 빌링키 · 카드사 · 끝 4자리', async () => {
    const fn = mockFetch(200, { billingKey: 'bk1', cardCompany: '현대', card: { number: '43301234****1234' } });
    expect(await pg.issueBillingKey('auth1', 'prop1')).toEqual({ billingKey: 'bk1', cardName: '현대', last4: '1234' });
    const [url, init] = call(fn);
    expect(url).toBe('https://api.tosspayments.com/v1/billing/authorizations/issue');
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from('test_sk_abc:').toString('base64')}`,
    );
    expect(JSON.parse(init.body as string)).toEqual({ authKey: 'auth1', customerKey: 'prop1' });
  });

  it('승인 성공 · 실패 사유 전달', async () => {
    let fn = mockFetch(200, { paymentKey: 'pk1' });
    const key = 'wj-0123456789abcdef0123456789abcdef-202611-M-1';
    expect(await pg.charge('bk1', 29_000, '우주스테이 11월', 'prop1', key)).toEqual({ ok: true, paymentKey: 'pk1' });
    const init = call(fn)[1];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ customerKey: 'prop1', amount: 29_000, orderName: '우주스테이 11월' });
    // 주문번호 = 멱등 키 (다시 보내도 토스가 두 번 승인하지 않는다)
    expect(body.orderId).toBe(key);
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(key);
    fn = mockFetch(400, { code: 'REJECT_CARD_COMPANY', message: '카드사에서 거절했어요.' });
    expect(await pg.charge('bk1', 29_000, 'x', 'prop1', 'wj-key-2')).toEqual({
      ok: false,
      reason: '카드사에서 거절했어요.',
    });
    await expect(pg.charge('bk1', 1, 'x', 'prop1', 'bad key!')).rejects.toThrow();
  });
});
