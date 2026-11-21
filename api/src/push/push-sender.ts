import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import type { DevicePlatform } from '../generated/prisma/enums.js';

/** 푸시 한 건 — link 는 앱 안 알림과 같은 화면 경로 (예: /app/staff?tab=attendance) */
export interface PushMessage {
  title: string;
  body: string;
  link?: string;
  /** 앱이 분기할 값 (모두 문자열) — kind · propertyId · notificationId 등 */
  data?: Record<string, string>;
  /** 급한 알림 — 안드로이드 high priority · iOS time-sensitive */
  urgent?: boolean;
}

export interface PushTarget {
  token: string;
  platform: DevicePlatform;
}

export interface PushResult {
  sent: number;
  /** FCM 이 무효라고 한 토큰 — 부르는 쪽이 지운다 */
  invalidTokens: string[];
}

/** 앱 푸시 — 실제(FCM)·가짜(로그)를 env 로 바꿔 끼운다 (SmsSender 와 같은 방식) */
export abstract class PushSender {
  abstract send(targets: PushTarget[], msg: PushMessage): Promise<PushResult>;
}

/** 개발용: 보내지 않고 로그에만 남긴다. 테스트는 outbox 를 읽는다 */
@Injectable()
export class LogPushSender extends PushSender {
  private readonly logger = new Logger('Push');
  readonly outbox: { token: string; platform: DevicePlatform; msg: PushMessage }[] = [];

  async send(targets: PushTarget[], msg: PushMessage): Promise<PushResult> {
    for (const t of targets) {
      this.outbox.push({ token: t.token, platform: t.platform, msg });
      this.logger.log(
        `[${t.platform} ${t.token.slice(0, 12)}…] ${msg.title} — ${msg.body}${msg.link ? ` (${msg.link})` : ''}`,
      );
    }
    return { sent: targets.length, invalidTokens: [] };
  }
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

/** FCM_SERVICE_ACCOUNT_JSON — JSON 원문이면 그대로, 아니면 파일 경로로 읽는다 */
export function loadServiceAccount(value: string): ServiceAccount {
  const raw = value.trim().startsWith('{') ? value : readFileSync(value.trim(), 'utf8');
  const sa = JSON.parse(raw) as Partial<ServiceAccount>;
  if (!sa.project_id || !sa.client_email || !sa.private_key)
    throw new Error('FCM_SERVICE_ACCOUNT_JSON 에 project_id · client_email · private_key 가 있어야 합니다.');
  return {
    project_id: sa.project_id,
    client_email: sa.client_email,
    private_key: sa.private_key,
    token_uri: sa.token_uri,
  };
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
/** 토큰이 더는 쓸 수 없다는 FCM 오류 — 지운다 (INVALID_ARGUMENT 는 토큰 문제일 때만: 보낸 내용이 틀린 경우와 구분) */
const INVALID_TOKEN_CODES = new Set(['UNREGISTERED', 'SENDER_ID_MISMATCH']);
const badToken = (status: number, code: string, message = '') =>
  status === 404 ||
  INVALID_TOKEN_CODES.has(code) ||
  (code === 'INVALID_ARGUMENT' && /registration token/i.test(message));

/**
 * FCM HTTP v1 (https://firebase.google.com/docs/cloud-messaging/send/v1-api).
 * 서비스 계정 키로 OAuth 액세스 토큰을 받아(55분 캐시) 기기마다 messages:send 를 부른다.
 * iOS 도 FCM 을 거쳐 APNs 로 간다 (Firebase 콘솔에 APNs 키 등록 필요).
 */
export class FcmPushSender extends PushSender {
  private readonly logger = new Logger('FcmPush');
  private access?: { token: string; until: number };

  constructor(
    private readonly sa: ServiceAccount,
    private readonly http: typeof fetch = fetch,
  ) {
    super();
  }

  private async accessToken(now = Date.now()): Promise<string> {
    if (this.access && this.access.until > now) return this.access.token;
    const iat = Math.floor(now / 1000);
    const aud = this.sa.token_uri ?? 'https://oauth2.googleapis.com/token';
    const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({ iss: this.sa.client_email, scope: SCOPE, aud, iat, exp: iat + 3600 }));
    const signer = createSign('RSA-SHA256');
    signer.update(`${head}.${claims}`);
    const assertion = `${head}.${claims}.${b64url(signer.sign(this.sa.private_key))}`;
    const res = await this.http(aud, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
    if (!res.ok || !body.access_token) throw new Error(`FCM 인증 실패 (${res.status})`);
    this.access = { token: body.access_token, until: now + Math.min(body.expires_in ?? 3600, 3300) * 1000 };
    return body.access_token;
  }

  private message(t: PushTarget, msg: PushMessage) {
    const data: Record<string, string> = { ...msg.data, ...(msg.link ? { link: msg.link } : {}) };
    return {
      message: {
        token: t.token,
        notification: { title: msg.title, body: msg.body },
        data,
        android: { priority: msg.urgent ? 'HIGH' : 'NORMAL', notification: { channel_id: 'uzustay_default' } },
        apns: {
          headers: { 'apns-priority': msg.urgent ? '10' : '5' },
          payload: { aps: { sound: 'default', ...(msg.urgent ? { 'interruption-level': 'time-sensitive' } : {}) } },
        },
      },
    };
  }

  async send(targets: PushTarget[], msg: PushMessage): Promise<PushResult> {
    if (targets.length === 0) return { sent: 0, invalidTokens: [] };
    const token = await this.accessToken();
    const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.sa.project_id)}/messages:send`;
    const invalidTokens: string[] = [];
    let sent = 0;
    await Promise.all(
      targets.map(async (t) => {
        try {
          const res = await this.http(url, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: JSON.stringify(this.message(t, msg)),
            signal: AbortSignal.timeout(10_000),
          });
          if (res.ok) {
            sent += 1;
            return;
          }
          const body = (await res.json().catch(() => ({}))) as {
            error?: { status?: string; message?: string; details?: { errorCode?: string }[] };
          };
          const code = body.error?.details?.find((d) => d.errorCode)?.errorCode ?? body.error?.status ?? '';
          if (badToken(res.status, code, body.error?.message)) invalidTokens.push(t.token);
          else this.logger.warn(`푸시 실패 ${res.status} ${code} ${body.error?.message ?? ''}`);
        } catch (e) {
          this.logger.warn(`푸시 실패: ${(e as Error).message}`);
        }
      }),
    );
    return { sent, invalidTokens };
  }
}
