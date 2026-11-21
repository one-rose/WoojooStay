import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { isValidBizNo } from '../src/common/utils/biz-no.js';
import { addDaysIso, kstDate } from '../src/common/utils/dates.js';
import { compareVersion } from '../src/mobile/mobile.controller.js';
import { safeAppPath } from '../src/mobile/web-handoff.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

/**
 * 모바일 앱 — 쿠키 없는 로그인(토큰은 JSON 본문) · /auth/me 로 역할별 첫 화면 · 앱 설정(강제 업데이트) · 앱 → 웹 화면 넘기기.
 * 휴대폰 번호는 010-8921-xxxx 만 쓴다.
 */
function validBizNo(prefix: string): string {
  for (let d = 0; d <= 9; d++) if (isValidBizNo(prefix + d)) return prefix + d;
  throw new Error('no');
}

describe('모바일 앱 (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const api = (p: string) => `/api/v1${p}`;
  const today = kstDate();

  async function signup(phone: string, name: string) {
    const sent = await http.post(api('/auth/phone/send-code')).send({ phone, purpose: 'signup' }).expect(200);
    const v = await http
      .post(api('/auth/phone/verify'))
      .send({ phone, purpose: 'signup', code: sent.body.devCode })
      .expect(200);
    const res = await http
      .post(api('/auth/signup'))
      .send({
        verificationToken: v.body.verificationToken,
        name,
        password: 'woojoo1234',
        agreements: { terms: true, privacy: true, marketing: false },
      })
      .expect(201);
    return res;
  }

  let ownerToken: string;
  let ownerId: string;
  let pid: string;
  let otherPid: string;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(m.createNestApplication());
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);

    const o = await signup('010-8921-0001', '앱 사장');
    ownerToken = o.body.accessToken;
    ownerId = o.body.user.id;
    const p = await http
      .post(api('/properties'))
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({
        name: '앱 호텔',
        type: 'HOTEL',
        address: '대전 중구',
        rooms: 8,
        bizNo: validBizNo('892100010'),
        ownerName: '사장',
      })
      .expect(201);
    pid = p.body.id;
    const other = await signup('010-8921-0009', '남의 사장');
    const op = await http
      .post(api('/properties'))
      .set({ Authorization: `Bearer ${other.body.accessToken}` })
      .send({
        name: '남의 호텔',
        type: 'HOTEL',
        address: '대전 서구',
        rooms: 8,
        bizNo: validBizNo('892100020'),
        ownerName: '사장',
      })
      .expect(201);
    otherPid = op.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('쿠키 없는 로그인 (앱)', () => {
    it('가입·로그인·갱신 모두 토큰을 JSON 본문으로 주고 Set-Cookie 는 없다', async () => {
      const login = await http
        .post(api('/auth/login'))
        .send({ phone: '010-8921-0001', password: 'woojoo1234' })
        .expect(200);
      expect(login.headers['set-cookie']).toBeUndefined();
      expect(login.body).toMatchObject({
        user: { id: ownerId, phone: '01089210001', name: '앱 사장', email: null },
        expiresIn: 1800,
      });
      expect(typeof login.body.accessToken).toBe('string');
      expect(typeof login.body.refreshToken).toBe('string');
      // 하이픈 없는 번호도 된다
      await http.post(api('/auth/login')).send({ phone: '01089210001', password: 'woojoo1234' }).expect(200);
      const bad = await http
        .post(api('/auth/login'))
        .send({ phone: '010-8921-0001', password: 'wrong12345' })
        .expect(401);
      expect(bad.body.errorCode).toBe('BAD_CREDENTIALS');

      const r = await http.post(api('/auth/refresh')).send({ refreshToken: login.body.refreshToken }).expect(200);
      expect(r.headers['set-cookie']).toBeUndefined();
      expect(Object.keys(r.body).sort()).toEqual(['accessToken', 'expiresIn', 'refreshToken']);
      // 30초 안에 같은 토큰을 다시 쓰면 401 만 (새 토큰으로 계속 쓸 수 있다)
      const again = await http.post(api('/auth/refresh')).send({ refreshToken: login.body.refreshToken }).expect(401);
      expect(again.body.errorCode).toBe('TOKEN_INVALID');
      await http
        .get(api('/auth/me'))
        .set({ Authorization: `Bearer ${r.body.accessToken}` })
        .expect(200);
      await http.post(api('/auth/refresh')).send({ refreshToken: r.body.refreshToken }).expect(200);
      // 토큰 없이 부르면 401 TOKEN_INVALID 가 아닌 UNAUTHORIZED 계열 (앱은 401 이면 갱신 → 실패면 로그인)
      const no = await http.get(api('/auth/me')).expect(401);
      expect(no.body.statusCode).toBe(401);
    });
  });

  describe('/auth/me — 업장별 역할로 첫 화면', () => {
    it('role · pilot · features · employeeId · clock 을 업장마다 준다', async () => {
      const staff = await http
        .post(api(`/properties/${pid}/staff/employees`))
        .set({ Authorization: `Bearer ${ownerToken}` })
        .send({
          name: '앱 직원',
          phone: '010-8921-0002',
          jobRole: 'HOUSEKEEPING',
          payType: 'HOURLY',
          payAmount: 11_000,
          hiredDate: addDaysIso(today, -10),
        })
        .expect(201);
      const s = await signup('010-8921-0002', '앱 직원');
      const me = await http
        .get(api('/auth/me'))
        .set({ Authorization: `Bearer ${s.body.accessToken}` })
        .expect(200);
      expect(me.body.properties).toEqual([
        {
          id: pid,
          name: '앱 호텔',
          type: 'HOTEL',
          rooms: 8,
          role: 'STAFF',
          pilot: null,
          features: { rates: true },
          employeeId: staff.body.id,
          clock: { locationSet: false, latitude: null, longitude: null, radiusM: 150 },
        },
      ]);
      const owner = await http
        .get(api('/auth/me'))
        .set({ Authorization: `Bearer ${ownerToken}` })
        .expect(200);
      expect(owner.body.properties[0]).toMatchObject({ id: pid, role: 'OWNER', employeeId: null });
      expect(owner.body.trialDays).toBeGreaterThan(0);
    });
  });

  describe('GET /app/config', () => {
    it('로그인 없이 — 플랫폼별 최소·최신 버전, 웹 주소, 업데이트 필요 여부', async () => {
      const c = await http.get(api('/app/config')).expect(200);
      expect(c.body).toMatchObject({
        platforms: {
          ANDROID: { minVersion: expect.stringMatching(/^\d+\.\d+\.\d+$/), storeUrl: null },
          IOS: { minVersion: expect.stringMatching(/^\d+\.\d+\.\d+$/) },
        },
        updateRequired: null,
        updateAvailable: null,
        webBaseUrl: expect.stringMatching(/^https?:\/\//),
      });
      expect(c.body.webBaseUrl.endsWith('/')).toBe(false);
      expect(Date.parse(c.body.serverTime)).not.toBeNaN();
      const old = await http.get(api('/app/config?platform=ANDROID&version=0.9.9')).expect(200);
      expect(old.body.updateRequired).toBe(true);
      const ok = await http.get(api('/app/config?platform=ios&version=1.0.0 (12)')).expect(200);
      expect(ok.body.updateRequired).toBe(false);
      await http.get(api('/app/config?platform=WEB&version=1.0.0')).expect(400);
    });

    it('버전 비교는 숫자로 (1.10.0 > 1.9.0)', () => {
      expect(compareVersion('1.10.0', '1.9.0')).toBeGreaterThan(0);
      expect(compareVersion('1.0.0 (3)', '1.0.0')).toBe(0);
      expect(compareVersion('0.9.9', '1.0.0')).toBeLessThan(0);
    });
  });

  describe('앱 → 웹 화면 넘기기', () => {
    const auth = () => ({ Authorization: `Bearer ${ownerToken}` });

    it('로그인해야 만들 수 있고, 코드는 60초 · 원문은 저장하지 않는다', async () => {
      await http.post(api('/auth/web-handoff')).send({ path: '/app/ledger' }).expect(401);
      const h = await http
        .post(api('/auth/web-handoff'))
        .set(auth())
        .send({ path: '/app/ledger?month=2026-11', propertyId: pid })
        .expect(201);
      expect(h.body).toMatchObject({ path: '/app/ledger?month=2026-11', propertyId: pid, expiresIn: 60 });
      expect(h.body.code).toMatch(/^[\w-]{43}$/);
      expect(h.body.url).toMatch(new RegExp(`/app/handoff\\?code=${h.body.code}$`));
      const row = await prisma.webHandoff.findFirstOrThrow({
        where: { userId: ownerId },
        orderBy: { createdAt: 'desc' },
      });
      expect(row.codeHash).not.toBe(h.body.code);
      expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeLessThanOrEqual(61_000);
    });

    it('한 번만 바꿀 수 있다 — 새 토큰(새 세션) + 열 화면 + 업장, 두 번째는 HANDOFF_INVALID', async () => {
      const h = await http
        .post(api('/auth/web-handoff'))
        .set(auth())
        .send({ path: '/app/expenses', propertyId: pid })
        .expect(201);
      const x = await http.post(api('/auth/web-handoff/exchange')).send({ code: h.body.code }).expect(200);
      expect(x.body).toMatchObject({ path: '/app/expenses', propertyId: pid, expiresIn: 1800, user: { id: ownerId } });
      const me = await http
        .get(api('/auth/me'))
        .set({ Authorization: `Bearer ${x.body.accessToken}` })
        .expect(200);
      expect(me.body.id).toBe(ownerId);
      // 웹 세션은 따로 갱신된다
      await http.post(api('/auth/refresh')).send({ refreshToken: x.body.refreshToken }).expect(200);
      const twice = await http.post(api('/auth/web-handoff/exchange')).send({ code: h.body.code }).expect(401);
      expect(twice.body.errorCode).toBe('HANDOFF_INVALID');
      const used = await prisma.webHandoff.findUniqueOrThrow({
        where: { id: (await prisma.webHandoff.findFirstOrThrow({ where: { path: '/app/expenses' } })).id },
      });
      expect(used.usedAt).not.toBeNull();
    });

    it('60초가 지나면 HANDOFF_INVALID, 없는 코드·이상한 코드도', async () => {
      const h = await http.post(api('/auth/web-handoff')).set(auth()).send({ path: '/app/settings' }).expect(201);
      await prisma.webHandoff.updateMany({
        where: { path: '/app/settings', usedAt: null },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const late = await http.post(api('/auth/web-handoff/exchange')).send({ code: h.body.code }).expect(401);
      expect(late.body.errorCode).toBe('HANDOFF_INVALID');
      const none = await http
        .post(api('/auth/web-handoff/exchange'))
        .send({ code: 'x'.repeat(43) })
        .expect(401);
      expect(none.body.errorCode).toBe('HANDOFF_INVALID');
      await http.post(api('/auth/web-handoff/exchange')).send({ code: '../../etc' }).expect(400);
    });

    it('/app 밖 경로는 /app 으로, 남의 업장은 404', async () => {
      for (const bad of [
        'https://evil.example',
        '//evil.example/app',
        '/app/ledger\r\nSet-Cookie: x=1',
        '/app\\evil',
        '/app/login',
        '/app/session/refresh',
        '/admin',
      ]) {
        const h = await http.post(api('/auth/web-handoff')).set(auth()).send({ path: bad }).expect(201);
        expect(h.body.path).toBe('/app');
      }
      const none = await http.post(api('/auth/web-handoff')).set(auth()).send({}).expect(201);
      expect(none.body.path).toBe('/app');
      await http.post(api('/auth/web-handoff')).set(auth()).send({ propertyId: otherPid }).expect(404);
      expect(safeAppPath('/app/handoff?code=1')).toBe('/app');
      expect(safeAppPath('/app/ledger?month=2026-11')).toBe('/app/ledger?month=2026-11');
    });

    it('넘기기 뒤 업장에서 빠졌으면 업장은 고르지 않는다 (propertyId null)', async () => {
      const s = await http
        .post(api('/auth/login'))
        .send({ phone: '010-8921-0002', password: 'woojoo1234' })
        .expect(200);
      const h = await http
        .post(api('/auth/web-handoff'))
        .set({ Authorization: `Bearer ${s.body.accessToken}` })
        .send({ path: '/app/me', propertyId: pid })
        .expect(201);
      await prisma.membership.deleteMany({ where: { userId: s.body.user.id, propertyId: pid } });
      const x = await http.post(api('/auth/web-handoff/exchange')).send({ code: h.body.code }).expect(200);
      expect(x.body.propertyId).toBeNull();
      expect(x.body.path).toBe('/app/me');
    });
  });
});
