import { generateKeyPairSync } from 'node:crypto';
import { FcmPushSender, loadServiceAccount } from './push-sender.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = {
  project_id: 'uzustay-test',
  client_email: 'push@uzustay-test.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('FCM HTTP v1 푸시', () => {
  it('서비스 계정 JSON 원문을 읽고, 빠진 값이 있으면 멈춘다', () => {
    expect(loadServiceAccount(JSON.stringify(SA)).project_id).toBe('uzustay-test');
    expect(() => loadServiceAccount('{"project_id":"x"}')).toThrow(/private_key/);
  });

  it('액세스 토큰을 한 번 받아 쓰고, 무효 토큰(UNREGISTERED · 404 · 토큰 INVALID_ARGUMENT)만 골라 준다', async () => {
    const calls: { url: string; body: string; auth?: string }[] = [];
    const http = vi.fn(async (url: string, init?: { body?: string | URLSearchParams; headers?: unknown }) => {
      const u = url;
      const raw = init?.body;
      const bodyText = raw instanceof URLSearchParams ? raw.toString() : (raw ?? '');
      calls.push({
        url: u,
        body: bodyText,
        auth: (init?.headers as Record<string, string> | undefined)?.authorization,
      });
      if (u.includes('oauth2')) return json(200, { access_token: 'ya29.test', expires_in: 3599 });
      const token = (JSON.parse(bodyText) as { message: { token: string } }).message.token;
      if (token === 'gone-token-aaaaaaaaaaaaaa')
        return json(404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } });
      if (token === 'bad-token-aaaaaaaaaaaaaaa')
        return json(400, {
          error: {
            status: 'INVALID_ARGUMENT',
            message: 'The registration token is not a valid FCM registration token',
          },
        });
      if (token === 'payload-err-aaaaaaaaaaaaa')
        return json(400, { error: { status: 'INVALID_ARGUMENT', message: 'Invalid JSON payload received.' } });
      if (token === 'server-err-aaaaaaaaaaaaaa') return json(503, { error: { status: 'UNAVAILABLE' } });
      return json(200, { name: 'projects/uzustay-test/messages/1' });
    });
    const sender = new FcmPushSender(SA, http as unknown as typeof fetch);
    const r = await sender.send(
      [
        { token: 'ok-token-aaaaaaaaaaaaaaaa', platform: 'ANDROID' },
        { token: 'gone-token-aaaaaaaaaaaaaa', platform: 'IOS' },
        { token: 'bad-token-aaaaaaaaaaaaaaa', platform: 'ANDROID' },
        { token: 'payload-err-aaaaaaaaaaaaa', platform: 'ANDROID' },
        { token: 'server-err-aaaaaaaaaaaaaa', platform: 'ANDROID' },
      ],
      {
        title: '스테이 오르빗',
        body: '김민지님이 출근 요청을 보냈어요',
        link: '/app/staff?tab=attendance',
        urgent: true,
      },
    );
    expect(r.sent).toBe(1);
    expect(r.invalidTokens.sort()).toEqual(['bad-token-aaaaaaaaaaaaaaa', 'gone-token-aaaaaaaaaaaaaa']);
    const sends = calls.filter((c) => c.url.includes('fcm.googleapis.com'));
    expect(sends[0].url).toBe('https://fcm.googleapis.com/v1/projects/uzustay-test/messages:send');
    expect(sends[0].auth).toBe('Bearer ya29.test');
    const msg = JSON.parse(sends[0].body) as { message: Record<string, any> };
    expect(msg.message.data.link).toBe('/app/staff?tab=attendance');
    expect(msg.message.android.priority).toBe('HIGH');
    expect(msg.message.notification.title).toBe('스테이 오르빗');

    // 두 번째 보낼 때는 토큰을 다시 받지 않는다
    await sender.send([{ token: 'ok-token-aaaaaaaaaaaaaaaa', platform: 'ANDROID' }], { title: 't', body: 'b' });
    expect(calls.filter((c) => c.url.includes('oauth2'))).toHaveLength(1);
    const jwt = new URLSearchParams(calls[0].body).get('assertion')!;
    const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()) as Record<string, unknown>;
    expect(claims.scope).toBe('https://www.googleapis.com/auth/firebase.messaging');
    expect(claims.iss).toBe(SA.client_email);
  });
});
