import { Injectable, Logger } from '@nestjs/common';
import { randomToken } from '../common/utils/crypto.js';

export interface BillingCard {
  billingKey: string;
  cardName: string;
  last4: string;
}

export type ChargeResult = { ok: true; paymentKey: string } | { ok: false; reason: string };

/**
 * 정기결제 PG (F0-09) — 토스페이먼츠 등 정해지면 이 인터페이스로 바꿔 끼운다.
 * 카드 번호는 우리 서버를 거치지 않는다: 화면의 PG 결제창이 authKey 를 주면 빌링키로 바꾼다.
 */
export abstract class PaymentGateway {
  abstract issueBillingKey(authKey: string, customerKey: string): Promise<BillingCard>;
  /**
   * customerKey — 빌링키를 받을 때 쓴 값과 같아야 한다 (업장 ID)
   * idempotencyKey — 같은 결제를 다시 보내도 한 번만 승인되도록 (PG 주문번호로도 쓴다, 6~64자 [A-Za-z0-9_=-])
   */
  abstract charge(
    billingKey: string,
    amount: number,
    orderName: string,
    customerKey: string,
    idempotencyKey: string,
  ): Promise<ChargeResult>;
}

/**
 * 개발용 — authKey 'fail' 이면 카드 등록 실패, 빌링키에 'decline' 이 들어가면 결제 실패.
 * 실제 PG 처럼 같은 멱등 키로 다시 오면 새로 승인하지 않고 앞 결과를 돌려준다 (charges 에 안 쌓임).
 */
@Injectable()
export class FakePaymentGateway extends PaymentGateway {
  readonly charges: { billingKey: string; amount: number; orderName: string; idempotencyKey: string }[] = [];
  private readonly results = new Map<string, ChargeResult>();

  async issueBillingKey(authKey: string): Promise<BillingCard> {
    if (authKey === 'fail') throw new Error('카드 인증 실패');
    const decline = authKey.includes('decline');
    return {
      billingKey: `${decline ? 'decline' : 'bk'}_${randomToken(12)}`,
      cardName: decline ? '한도초과카드' : '우주카드',
      last4: decline ? '0000' : '4242',
    };
  }

  async charge(
    billingKey: string,
    amount: number,
    orderName: string,
    _customerKey: string,
    idempotencyKey: string,
  ): Promise<ChargeResult> {
    const seen = this.results.get(idempotencyKey);
    if (seen) return seen;
    this.charges.push({ billingKey, amount, orderName, idempotencyKey });
    const r: ChargeResult = billingKey.startsWith('decline')
      ? { ok: false, reason: '카드 한도가 부족해요.' }
      : { ok: true, paymentKey: `pay_${randomToken(10)}` };
    this.results.set(idempotencyKey, r);
    return r;
  }
}

interface TossError {
  code?: string;
  message?: string;
}

/**
 * 토스페이먼츠 자동결제(빌링) — https://docs.tosspayments.com/reference#자동결제
 * 1) 화면의 결제창(requestBillingAuth)이 authKey 를 준다 → 빌링키 발급
 * 2) 매달 빌링키로 승인 요청
 */
export class TossPaymentGateway extends PaymentGateway {
  private readonly logger = new Logger('TossPayments');
  private readonly auth: string;

  constructor(
    secretKey: string,
    private readonly baseUrl = 'https://api.tosspayments.com/v1',
  ) {
    super();
    this.auth = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
  }

  private async post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        authorization: this.auth,
        'content-type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json().catch(() => ({}))) as T & TossError;
    if (!res.ok) throw Object.assign(new Error(data.message ?? `HTTP ${res.status}`), { code: data.code });
    return data;
  }

  async issueBillingKey(authKey: string, customerKey: string): Promise<BillingCard> {
    const r = await this.post<{ billingKey: string; cardCompany?: string; card?: { number?: string } }>(
      '/billing/authorizations/issue',
      { authKey, customerKey },
    );
    const number = r.card?.number ?? '';
    return { billingKey: r.billingKey, cardName: r.cardCompany ?? '카드', last4: number.slice(-4) };
  }

  async charge(
    billingKey: string,
    amount: number,
    orderName: string,
    customerKey: string,
    idempotencyKey: string,
  ): Promise<ChargeResult> {
    if (!/^[A-Za-z0-9_=-]{6,64}$/.test(idempotencyKey)) throw new Error(`잘못된 주문번호: ${idempotencyKey}`);
    // 주문번호를 멱등 키와 같게 — 다시 보내도 토스가 같은 결제로 본다
    const orderId = idempotencyKey;
    try {
      const r = await this.post<{ paymentKey: string }>(
        `/billing/${encodeURIComponent(billingKey)}`,
        { customerKey, amount, orderId, orderName: orderName.slice(0, 100) },
        idempotencyKey,
      );
      return { ok: true, paymentKey: r.paymentKey };
    } catch (e) {
      this.logger.warn(`정기결제 실패 ${orderId}: ${(e as Error).message}`);
      return { ok: false, reason: (e as Error).message };
    }
  }
}
