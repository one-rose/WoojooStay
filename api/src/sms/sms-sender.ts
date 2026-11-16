import { Injectable, Logger } from '@nestjs/common';

/** 문자 발송 — 실제 업체(알리고·NHN 등) 정해지면 이 인터페이스로 구현을 바꿔 끼운다 */
export abstract class SmsSender {
  abstract send(phone: string, text: string): Promise<void>;
}

/** 개발용: 문자를 보내지 않고 로그에만 남긴다. 테스트에서 마지막 문자를 읽을 수 있다. */
@Injectable()
export class ConsoleSmsSender extends SmsSender {
  private readonly logger = new Logger('SMS');
  readonly outbox: { phone: string; text: string }[] = [];

  async send(phone: string, text: string): Promise<void> {
    this.outbox.push({ phone, text });
    this.logger.log(`[${phone}] ${text}`);
  }

  lastTo(phone: string): string | undefined {
    return [...this.outbox].reverse().find((m) => m.phone === phone)?.text;
  }
}

/**
 * 알리고 문자 (https://smartsms.aligo.in) — 90바이트 넘으면 LMS 로 보낸다.
 * 알리고는 등록한 발신번호와 등록한 서버 IP 에서만 발송된다.
 */
export class AligoSmsSender extends SmsSender {
  private readonly logger = new Logger('AligoSms');

  constructor(
    private readonly cfg: { apiKey: string; userId: string; sender: string; testMode?: boolean },
    private readonly endpoint = 'https://apis.aligo.in/send/',
  ) {
    super();
  }

  async send(phone: string, text: string): Promise<void> {
    const form = new URLSearchParams({
      key: this.cfg.apiKey,
      user_id: this.cfg.userId,
      sender: this.cfg.sender.replace(/\D/g, ''),
      receiver: phone.replace(/\D/g, ''),
      msg: text,
      msg_type: Buffer.byteLength(text, 'utf8') > 90 ? 'LMS' : 'SMS',
      ...(this.cfg.testMode ? { testmode_yn: 'Y' } : {}),
    });
    const res = await fetch(this.endpoint, { method: 'POST', body: form, signal: AbortSignal.timeout(10_000) });
    const body = (await res.json().catch(() => ({}))) as { result_code?: string | number; message?: string };
    if (Number(body.result_code) !== 1) {
      this.logger.error(`문자 발송 실패 [${phone}] ${body.result_code} ${body.message ?? res.status}`);
      throw new Error(`문자 발송 실패: ${body.message ?? res.status}`);
    }
  }
}
