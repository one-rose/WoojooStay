import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { isValidBizNo } from '../src/common/utils/biz-no.js';
import { addDaysIso, dateOnly, kstDate, monthStart } from '../src/common/utils/dates.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PushSender, type PushMessage, type PushResult, type PushTarget } from '../src/push/push-sender.js';
import { setupApp } from '../src/setup-app.js';
import { distanceM } from '../src/staff/clock-presence.js';
import { ClockService } from '../src/staff/clock.service.js';

/**
 * 모바일 앱용 API — 출근 위치·QR 확인, 출퇴근 요청 승인·거절, 푸시 기기, 앱 푸시.
 * 휴대폰 번호는 010-8920-xxxx 만 쓴다.
 */
function validBizNo(prefix: string): string {
  for (let d = 0; d <= 9; d++) if (isValidBizNo(prefix + d)) return prefix + d;
  throw new Error('no');
}

/** 테스트용 푸시 — 보낸 것을 모으고, dead- 로 시작하는 토큰은 FCM 이 무효라고 한 것처럼 */
class FakePush extends PushSender {
  readonly sent: { target: PushTarget; msg: PushMessage }[] = [];
  async send(targets: PushTarget[], msg: PushMessage): Promise<PushResult> {
    for (const target of targets) this.sent.push({ target, msg });
    return {
      sent: targets.filter((t) => !t.token.startsWith('dead-')).length,
      invalidTokens: targets.filter((t) => t.token.startsWith('dead-')).map((t) => t.token),
    };
  }
  to(token: string) {
    return this.sent.filter((s) => s.target.token === token);
  }
  clear() {
    this.sent.length = 0;
  }
}

/** 을지로 어딘가 */
const HOME = { lat: 37.5663, lng: 126.9918 };
/** HOME 에서 북쪽으로 m 미터 */
const north = (m: number) => ({ latitude: HOME.lat + m / 111_195, longitude: HOME.lng });
const meters = (p: { latitude: number; longitude: number }) =>
  Math.round(distanceM({ lat: p.latitude, lng: p.longitude }, HOME));

describe('모바일 앱 API — 출근 확인 · 출퇴근 요청 · 푸시 (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let clockSvc: ClockService;
  const push = new FakePush();
  const api = (p: string) => `/api/v1${p}`;
  type Auth = { Authorization: string };
  type User = { auth: Auth; userId: string };
  const today = kstDate();

  async function signup(phone: string, name: string): Promise<User> {
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
    return { auth: { Authorization: `Bearer ${res.body.accessToken}` }, userId: res.body.user.id as string };
  }

  async function property(owner: Auth, prefix: string, name: string) {
    const p = await http
      .post(api('/properties'))
      .set(owner)
      .send({ name, type: 'HOTEL', address: '서울 중구', rooms: 10, bizNo: validBizNo(prefix), ownerName: '사장' })
      .expect(201);
    return p.body.id as string;
  }

  async function employee(owner: Auth, pid: string, name: string, phone: string) {
    const e = await http
      .post(api(`/properties/${pid}/staff/employees`))
      .set(owner)
      .send({ name, phone, jobRole: 'FRONT', payType: 'HOURLY', payAmount: 11_000, hiredDate: addDaysIso(today, -60) })
      .expect(201);
    return e.body.id as string;
  }

  const clock = (who: Auth, pid: string, body: Record<string, unknown>) =>
    http
      .post(api(`/properties/${pid}/staff/attendance/clock`))
      .set(who)
      .send(body);

  let owner: User;
  let manager: User;
  let minji: User;
  let outsider: User;
  let pid: string;
  let otherPid: string;
  let minjiId: string;
  let managerEmpId: string;
  const resetMinji = () => prisma.attendance.deleteMany({ where: { employeeId: minjiId } });

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PushSender)
      .useValue(push)
      .compile();
    app = setupApp(m.createNestApplication());
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    clockSvc = app.get(ClockService);

    owner = await signup('010-8920-0001', '모바일 사장');
    pid = await property(owner.auth, '892000010', '모바일 호텔');
    minjiId = await employee(owner.auth, pid, '김민지', '010-8920-0002');
    minji = await signup('010-8920-0002', '김민지');
    manager = await signup('010-8920-0003', '최매니저');
    await prisma.membership.create({ data: { userId: manager.userId, propertyId: pid, role: 'MANAGER' } });
    // 매니저도 이 업장 직원 명단에 있다 (자기 요청 승인 막기 확인용)
    managerEmpId = await employee(owner.auth, pid, '최매니저', '010-8920-0003');
    outsider = await signup('010-8920-0004', '남의 사장');
    otherPid = await property(outsider.auth, '892000020', '남의 호텔');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('업장 위치가 없을 때 (지금처럼)', () => {
    it('me·staff/me 에 locationSet false, 위치 없이 출근해도 허용 (check.locationSet false)', async () => {
      const me = await http.get(api('/auth/me')).set(owner.auth).expect(200);
      expect(me.body.properties[0].clock).toEqual({
        locationSet: false,
        latitude: null,
        longitude: null,
        radiusM: 150,
      });
      const mine = await http
        .get(api(`/properties/${pid}/staff/me`))
        .set(minji.auth)
        .expect(200);
      expect(mine.body.clock.locationSet).toBe(false);
      expect(mine.body.requests).toEqual([]);

      // 예전 화면처럼 method 만
      const r = await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', method: 'GPS' }).expect(200);
      expect(r.body.method).toBe('GPS');
      expect(r.body.check).toEqual({ method: 'GPS', distanceM: null, radiusM: 150, locationSet: false });
      // 위치를 보내도 업장 위치가 없으면 거리 없이 허용
      const out = await clock(minji.auth, pid, { employeeId: minjiId, action: 'out', ...north(5000) }).expect(200);
      expect(out.body.outMethod).toBe('GPS');
      expect(out.body.check.locationSet).toBe(false);
      await resetMinji();
    });
  });

  describe('업장 위치·반경 설정 (사장님만)', () => {
    it('위도·경도는 함께, 반경은 50~1000m, 매니저·직원은 못 바꾼다', async () => {
      const half = await http
        .patch(api(`/properties/${pid}`))
        .set(owner.auth)
        .send({ latitude: HOME.lat })
        .expect(400);
      expect(half.body.errorCode).toBe('VALIDATION');
      const small = await http
        .patch(api(`/properties/${pid}`))
        .set(owner.auth)
        .send({ clockRadiusM: 20 })
        .expect(400);
      expect(small.body.message).toContain('50m');
      await http
        .patch(api(`/properties/${pid}`))
        .set(manager.auth)
        .send({ latitude: HOME.lat, longitude: HOME.lng })
        .expect(403);
      await http
        .patch(api(`/properties/${pid}`))
        .set(minji.auth)
        .send({ clockRadiusM: 500 })
        .expect(403);
      const ok = await http
        .patch(api(`/properties/${pid}`))
        .set(owner.auth)
        .send({ latitude: HOME.lat, longitude: HOME.lng, clockRadiusM: 150 })
        .expect(200);
      expect(ok.body.clock).toEqual({ locationSet: true, latitude: HOME.lat, longitude: HOME.lng, radiusM: 150 });

      // 직원은 위치·반경은 보지만 QR 키 번호·사업자번호는 못 본다
      const staffView = await http
        .get(api(`/properties/${pid}`))
        .set(minji.auth)
        .expect(200);
      expect(staffView.body.clock.locationSet).toBe(true);
      expect(staffView.body.clockQrKeyVersion).toBeUndefined();
      expect(staffView.body.bizNo).toBeUndefined();
      const mine = await http
        .get(api(`/properties/${pid}/staff/me`))
        .set(minji.auth)
        .expect(200);
      expect(mine.body.clock).toMatchObject({ locationSet: true, radiusM: 150 });
      const me = await http.get(api('/auth/me')).set(minji.auth).expect(200);
      expect(me.body.properties.find((p: { id: string }) => p.id === pid).clock.locationSet).toBe(true);
    });
  });

  describe('위치로 출퇴근', () => {
    afterEach(resetMinji);

    it('반경 안이면 출근, 거리(inDistanceM)를 남긴다', async () => {
      const at = north(100);
      const r = await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', ...at, accuracy: 15 }).expect(200);
      expect(r.body.method).toBe('GPS');
      expect(r.body.inDistanceM).toBe(meters(at));
      expect(r.body.check).toMatchObject({ method: 'GPS', radiusM: 150, locationSet: true });
      const mine = await http
        .get(api(`/properties/${pid}/staff/me`))
        .set(minji.auth)
        .expect(200);
      expect(mine.body.today.method).toBe('GPS');
      // 퇴근도 위치를 본다
      const far = await clock(minji.auth, pid, { employeeId: minjiId, action: 'out', ...north(400) }).expect(400);
      expect(far.body.errorCode).toBe('OUT_OF_RANGE');
      const out = await clock(minji.auth, pid, { employeeId: minjiId, action: 'out', ...north(20) }).expect(200);
      expect(out.body.outMethod).toBe('GPS');
      expect(out.body.outDistanceM).toBe(meters(north(20)));
    });

    it('반경 밖이면 OUT_OF_RANGE — 몇 m 떨어졌는지 한국어로, distanceM·radiusM 도 내려준다', async () => {
      const at = north(320);
      const r = await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', ...at, accuracy: 10 }).expect(400);
      expect(r.body.errorCode).toBe('OUT_OF_RANGE');
      expect(r.body.message).toBe(`업장에서 ${meters(at)}m 떨어져 있어요. 업장 150m 안에서 다시 눌러 주세요.`);
      expect(r.body.distanceM).toBe(meters(at));
      expect(r.body.radiusM).toBe(150);
      expect(r.body.accuracyM).toBe(10);
      const km = await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', ...north(2340) }).expect(400);
      expect(km.body.message).toContain('2.3km');
      expect(await prisma.attendance.count({ where: { employeeId: minjiId } })).toBe(0);
    });

    it('정확도만큼 봐주되 100m 까지만 — (거리 − min(정확도, 100)) ≤ 반경', async () => {
      await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', ...north(200), accuracy: 40 }).expect(400);
      await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', ...north(270), accuracy: 5000 }).expect(400);
      await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', ...north(200), accuracy: 60 }).expect(200);
    });

    it('업장 위치가 있는데 위치·QR 이 없으면 LOCATION_REQUIRED, 위도만 보내면 VALIDATION', async () => {
      const r = await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', method: 'GPS' }).expect(400);
      expect(r.body.errorCode).toBe('LOCATION_REQUIRED');
      const half = await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', latitude: HOME.lat }).expect(400);
      expect(half.body.errorCode).toBe('VALIDATION');
      const bad = await clock(minji.auth, pid, {
        employeeId: minjiId,
        action: 'in',
        latitude: 200,
        longitude: 1,
      }).expect(400);
      expect(bad.body.message).toContain('위도');
      // 요청으로 하라는 값은 받지 않는다
      await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', method: 'REQUEST' }).expect(400);
    });

    it('사장님이 다른 직원을 찍어 주면 위치 없이 수기(MANUAL)', async () => {
      const r = await clock(owner.auth, pid, { employeeId: minjiId, action: 'in' }).expect(200);
      expect(r.body.method).toBe('MANUAL');
      expect(r.body.check.method).toBe('MANUAL');
    });
  });

  describe('출근 QR', () => {
    afterEach(resetMinji);

    it('사장님·매니저가 QR 내용을 받고, 직원은 못 받는다', async () => {
      const o = await http
        .get(api(`/properties/${pid}/clock-qr`))
        .set(owner.auth)
        .expect(200);
      expect(o.body.payload).toMatch(new RegExp(`^uzustay://clock\\?p=${pid}&k=1&s=[\\w-]{24}$`));
      expect(o.body.propertyName).toBe('모바일 호텔');
      const m = await http
        .get(api(`/properties/${pid}/clock-qr`))
        .set(manager.auth)
        .expect(200);
      expect(m.body.payload).toBe(o.body.payload);
      await http
        .get(api(`/properties/${pid}/clock-qr`))
        .set(minji.auth)
        .expect(403);
      await http
        .get(api(`/properties/${pid}/clock-qr`))
        .set(outsider.auth)
        .expect(404);
    });

    it('맞는 QR 이면 위치 없이 출근 (method QR), 틀린 QR 은 QR_INVALID', async () => {
      const { body } = await http
        .get(api(`/properties/${pid}/clock-qr`))
        .set(owner.auth)
        .expect(200);
      const bad = await clock(minji.auth, pid, {
        employeeId: minjiId,
        action: 'in',
        qr: body.payload.slice(0, -3) + 'AAA',
      }).expect(400);
      expect(bad.body.errorCode).toBe('QR_INVALID');
      const junk = await clock(minji.auth, pid, {
        employeeId: minjiId,
        action: 'in',
        qr: 'https://example.com',
      }).expect(400);
      expect(junk.body.errorCode).toBe('QR_INVALID');
      const noQr = await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', method: 'QR' }).expect(400);
      expect(noQr.body.errorCode).toBe('QR_INVALID');
      // QR 이면 멀리 있어도 (위치는 참고로만)
      const ok = await clock(minji.auth, pid, {
        employeeId: minjiId,
        action: 'in',
        method: 'QR',
        qr: body.payload,
        ...north(900),
      }).expect(200);
      expect(ok.body.method).toBe('QR');
      expect(ok.body.check.method).toBe('QR');
    });

    it('다른 업장 QR 은 QR_OTHER_PROPERTY', async () => {
      const other = await http
        .get(api(`/properties/${otherPid}/clock-qr`))
        .set(outsider.auth)
        .expect(200);
      const r = await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', qr: other.body.payload }).expect(400);
      expect(r.body.errorCode).toBe('QR_OTHER_PROPERTY');
    });

    it('QR 새로 만들기(사장님만) — 예전 QR 은 QR_EXPIRED, 새 QR 은 된다', async () => {
      const old = await http
        .get(api(`/properties/${pid}/clock-qr`))
        .set(owner.auth)
        .expect(200);
      await http
        .post(api(`/properties/${pid}/clock-qr/rotate`))
        .set(manager.auth)
        .expect(403);
      const fresh = await http
        .post(api(`/properties/${pid}/clock-qr/rotate`))
        .set(owner.auth)
        .expect(200);
      expect(fresh.body.keyVersion).toBe(old.body.keyVersion + 1);
      expect(fresh.body.payload).not.toBe(old.body.payload);
      expect(fresh.body.payload).toBe(clockSvc.payloadFor(pid, fresh.body.keyVersion));
      const expired = await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', qr: old.body.payload }).expect(
        400,
      );
      expect(expired.body.errorCode).toBe('QR_EXPIRED');
      await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', qr: fresh.body.payload }).expect(200);
    });
  });

  describe('푸시 기기', () => {
    it('로그인해야 하고, 같은 토큰은 한 줄로 갱신 · 다른 계정이 로그인하면 그 계정으로', async () => {
      await http.post(api('/devices')).send({ platform: 'ANDROID', token: 'owner-token-aaaaaaaaaaaa' }).expect(401);
      const bad = await http
        .post(api('/devices'))
        .set(owner.auth)
        .send({ platform: 'WINDOWS', token: 'owner-token-aaaaaaaaaaaa' })
        .expect(400);
      expect(bad.body.errorCode).toBe('VALIDATION');
      await http.post(api('/devices')).set(owner.auth).send({ platform: 'ANDROID', token: 'short' }).expect(400);
      const a = await http
        .post(api('/devices'))
        .set(owner.auth)
        .send({ platform: 'ANDROID', token: 'owner-token-aaaaaaaaaaaa', appVersion: '1.0.0 (1)' })
        .expect(200);
      expect(a.body).toMatchObject({ platform: 'ANDROID', appVersion: '1.0.0 (1)' });
      const b = await http
        .post(api('/devices'))
        .set(owner.auth)
        .send({ platform: 'ANDROID', token: 'owner-token-aaaaaaaaaaaa', appVersion: '1.0.1 (2)' })
        .expect(200);
      expect(b.body.id).toBe(a.body.id);
      expect(new Date(b.body.lastSeenAt).getTime()).toBeGreaterThanOrEqual(new Date(a.body.lastSeenAt).getTime());
      expect(await prisma.device.count({ where: { token: 'owner-token-aaaaaaaaaaaa' } })).toBe(1);

      // 한 기기에서 다른 계정으로 로그인
      await http
        .post(api('/devices'))
        .set(outsider.auth)
        .send({ platform: 'IOS', token: 'shared-token-aaaaaaaaaaa' })
        .expect(200);
      await http
        .post(api('/devices'))
        .set(manager.auth)
        .send({ platform: 'IOS', token: 'shared-token-aaaaaaaaaaa' })
        .expect(200);
      const shared = await prisma.device.findUniqueOrThrow({ where: { token: 'shared-token-aaaaaaaaaaa' } });
      expect(shared.userId).toBe(manager.userId);
      expect(shared.platform).toBe('IOS');
    });

    it('해제는 내 토큰만 (남의 토큰·없는 토큰도 204)', async () => {
      await http.post(api('/devices')).set(minji.auth).send({ platform: 'ANDROID', token: 'minji-token-aaaaaaaaaaaa' });
      await http.delete(api('/devices/minji-token-aaaaaaaaaaaa')).set(owner.auth).expect(204);
      expect(await prisma.device.count({ where: { token: 'minji-token-aaaaaaaaaaaa' } })).toBe(1);
      await http.delete(api('/devices/nothing-here-aaaaaaaaaaa')).set(minji.auth).expect(204);
      await http.delete(api('/devices/minji-token-aaaaaaaaaaaa')).expect(401);
      await http.delete(api('/devices/minji-token-aaaaaaaaaaaa')).set(minji.auth).expect(204);
      expect(await prisma.device.count({ where: { token: 'minji-token-aaaaaaaaaaaa' } })).toBe(0);
      // 다시 등록해 둔다 (아래 승인 알림 푸시용)
      await http
        .post(api('/devices'))
        .set(minji.auth)
        .send({ platform: 'ANDROID', token: 'minji-token-aaaaaaaaaaaa' })
        .expect(200);
    });
  });

  describe('출퇴근 요청', () => {
    beforeEach(async () => {
      await resetMinji();
      await prisma.clockRequest.deleteMany({ where: { propertyId: pid } });
      push.clear();
    });

    const create = (who: Auth, body: Record<string, unknown>, p = pid) =>
      http
        .post(api(`/properties/${p}/staff/clock-requests`))
        .set(who)
        .send(body);

    it('출근 요청 → 사장님·매니저 알림 + 푸시 → 매니저 승인 → 요청 시각으로 출근(REQUEST) + 직원 알림·푸시', async () => {
      const short = await create(minji.auth, { type: 'IN', reason: '아' }).expect(400);
      expect(short.body.message).toContain('2자');
      const requestedAt = new Date(Date.now() - 20 * 60_000).toISOString();
      const at = north(600);
      const r = await create(minji.auth, {
        type: 'IN',
        reason: '휴대폰 위치가 안 잡혀요',
        requestedAt,
        ...at,
        accuracy: 30,
      }).expect(201);
      expect(r.body).toMatchObject({
        type: 'IN',
        status: 'PENDING',
        reason: '휴대폰 위치가 안 잡혀요',
        requestedAt,
        distanceM: meters(at),
        accuracyM: 30,
      });
      const again = await create(minji.auth, { type: 'IN', reason: '다시 보내요' }).expect(409);
      expect(again.body.errorCode).toBe('CLOCK_REQUEST_PENDING');

      // 사장님·매니저에게 앱 알림 + 앱 푸시 (등록한 기기로, 링크 포함)
      const noti = await http
        .get(api(`/notifications?propertyId=${pid}`))
        .set(owner.auth)
        .expect(200);
      expect(noti.body.items[0].text).toContain('김민지님이 출근 요청을 보냈어요');
      expect(noti.body.items[0].link).toBe('/app/staff?tab=attendance');
      const ownerPush = push.to('owner-token-aaaaaaaaaaaa');
      expect(ownerPush).toHaveLength(1);
      expect(ownerPush[0].msg).toMatchObject({ title: '모바일 호텔', link: '/app/staff?tab=attendance' });
      expect(ownerPush[0].msg.data).toMatchObject({
        kind: 'STAFF',
        propertyId: pid,
        notificationId: noti.body.items[0].id,
      });
      expect(push.to('shared-token-aaaaaaaaaaa')).toHaveLength(1); // 매니저 기기
      expect(push.to('minji-token-aaaaaaaaaaaa')).toHaveLength(0);

      // 목록 — 사장님·매니저만, 직원은 403, 남의 업장은 404
      const list = await http
        .get(api(`/properties/${pid}/staff/clock-requests`))
        .set(manager.auth)
        .expect(200);
      expect(list.body.pending).toBe(1);
      expect(list.body.items[0]).toMatchObject({ id: r.body.id, name: '김민지', type: 'IN' });
      await http
        .get(api(`/properties/${pid}/staff/clock-requests`))
        .set(minji.auth)
        .expect(403);
      const ov = await http
        .get(api(`/properties/${pid}/staff`))
        .set(owner.auth)
        .expect(200);
      expect(ov.body.clockRequests).toHaveLength(1);
      const mine = await http
        .get(api(`/properties/${pid}/staff/clock-requests/mine`))
        .set(minji.auth)
        .expect(200);
      expect(mine.body.items[0].status).toBe('PENDING');

      // 직원은 승인 못 함, 남의 업장 사장님은 404
      await http
        .post(api(`/properties/${pid}/staff/clock-requests/${r.body.id}/approve`))
        .set(minji.auth)
        .expect(403);
      await http
        .post(api(`/properties/${otherPid}/staff/clock-requests/${r.body.id}/approve`))
        .set(outsider.auth)
        .expect(404);
      await http
        .post(api(`/properties/${pid}/staff/clock-requests/${r.body.id}/approve`))
        .set(outsider.auth)
        .expect(404);

      push.clear();
      const ok = await http
        .post(api(`/properties/${pid}/staff/clock-requests/${r.body.id}/approve`))
        .set(manager.auth)
        .expect(200);
      expect(ok.body.status).toBe('APPROVED');
      expect(ok.body.attendance.method).toBe('REQUEST');
      expect(new Date(ok.body.attendance.clockInAt).toISOString()).toBe(requestedAt);
      expect(ok.body.attendance.inDistanceM).toBe(meters(at));
      const twice = await http
        .post(api(`/properties/${pid}/staff/clock-requests/${r.body.id}/approve`))
        .set(owner.auth)
        .expect(409);
      expect(twice.body.errorCode).toBe('CLOCK_REQUEST_DECIDED');

      // 직원에게 알림(본인만) + 푸시
      const staffNoti = await http.get(api('/notifications')).set(minji.auth).expect(200);
      expect(staffNoti.body.items).toHaveLength(1);
      expect(staffNoti.body.items[0].text).toContain('출근 요청이 승인됐어요');
      expect(staffNoti.body.items[0].link).toBe('/app/me');
      const ownerNoti = await http
        .get(api(`/notifications?propertyId=${pid}`))
        .set(owner.auth)
        .expect(200);
      expect(ownerNoti.body.items.some((n: { text: string }) => n.text.includes('승인됐어요'))).toBe(false);
      expect(push.to('minji-token-aaaaaaaaaaaa')).toHaveLength(1);
      expect(push.to('minji-token-aaaaaaaaaaaa')[0].msg.link).toBe('/app/me');

      const me = await http
        .get(api(`/properties/${pid}/staff/me`))
        .set(minji.auth)
        .expect(200);
      expect(me.body.state).toBe('working');
      expect(me.body.today.method).toBe('REQUEST');
      expect(me.body.requests[0]).toMatchObject({ status: 'APPROVED', type: 'IN' });
      const ov2 = await http
        .get(api(`/properties/${pid}/staff`))
        .set(owner.auth)
        .expect(200);
      expect(ov2.body.today.find((t: { employeeId: string }) => t.employeeId === minjiId)).toMatchObject({
        status: 'working',
        method: 'REQUEST',
      });
      expect(ov2.body.clockRequests).toHaveLength(0);
    });

    it('퇴근 요청 거절(사유 필수) → 기록 그대로, 다시 보내 승인 → 요청 시각으로 퇴근', async () => {
      await create(minji.auth, { type: 'OUT', reason: '퇴근 버튼이 안 눌려요' }).expect(400); // 출근 기록 없음
      await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', ...north(10) }).expect(200);
      const r = await create(minji.auth, { type: 'OUT', reason: '배터리가 꺼졌어요' }).expect(201);
      const noReason = await http
        .post(api(`/properties/${pid}/staff/clock-requests/${r.body.id}/reject`))
        .set(owner.auth)
        .send({})
        .expect(400);
      expect(noReason.body.errorCode).toBe('VALIDATION');
      const rej = await http
        .post(api(`/properties/${pid}/staff/clock-requests/${r.body.id}/reject`))
        .set(owner.auth)
        .send({ reason: '아직 근무 중이에요' })
        .expect(200);
      expect(rej.body).toMatchObject({ status: 'REJECTED', rejectReason: '아직 근무 중이에요' });
      const a = await prisma.attendance.findFirstOrThrow({ where: { employeeId: minjiId } });
      expect(a.clockOutAt).toBeNull();
      const staffNoti = await http
        .get(api(`/notifications?propertyId=${pid}`))
        .set(minji.auth)
        .expect(200);
      expect(staffNoti.body.items[0].text).toContain('퇴근 요청이 거절됐어요. 사유: 아직 근무 중이에요');

      const r2 = await create(minji.auth, { type: 'OUT', reason: '배터리가 꺼졌어요' }).expect(201);
      const ok = await http
        .post(api(`/properties/${pid}/staff/clock-requests/${r2.body.id}/approve`))
        .set(owner.auth)
        .expect(200);
      expect(ok.body.attendance.outMethod).toBe('REQUEST');
      expect(new Date(ok.body.attendance.clockOutAt).toISOString()).toBe(r2.body.requestedAt);
      expect(ok.body.attendance.method).toBe('GPS');
    });

    it('출근 승인 전 퇴근 요청은 보낼 수 있지만, 퇴근부터 승인하면 CLOCK_IN_PENDING', async () => {
      await create(minji.auth, {
        type: 'IN',
        reason: '위치가 안 잡혀요',
        requestedAt: new Date(Date.now() - 3_600_000).toISOString(),
      }).expect(201);
      const out = await create(minji.auth, { type: 'OUT', reason: '위치가 안 잡혀요' }).expect(201);
      const r = await http
        .post(api(`/properties/${pid}/staff/clock-requests/${out.body.id}/approve`))
        .set(owner.auth)
        .expect(409);
      expect(r.body.errorCode).toBe('CLOCK_IN_PENDING');
    });

    it('요청 시각은 12시간 전까지, 앞으로 올 시각은 안 된다', async () => {
      const old = await create(minji.auth, {
        type: 'IN',
        reason: '어제 깜빡했어요',
        requestedAt: new Date(Date.now() - 13 * 3_600_000).toISOString(),
      }).expect(400);
      expect(old.body.errorCode).toBe('REQUESTED_AT_INVALID');
      await create(minji.auth, {
        type: 'IN',
        reason: '미리 보내요',
        requestedAt: new Date(Date.now() + 3_600_000).toISOString(),
      }).expect(400);
    });

    it('이미 출근했으면 출근 요청 불가, 직원 명단에 없는 사람(사장님)은 NOT_LINKED_EMPLOYEE', async () => {
      await clock(minji.auth, pid, { employeeId: minjiId, action: 'in', ...north(10) }).expect(200);
      const r = await create(minji.auth, { type: 'IN', reason: '다시 출근' }).expect(409);
      expect(r.body.errorCode).toBe('ALREADY_CLOCKED_IN');
      const o = await create(owner.auth, { type: 'IN', reason: '사장 출근' }).expect(404);
      expect(o.body.errorCode).toBe('NOT_LINKED_EMPLOYEE');
      await create(outsider.auth, { type: 'IN', reason: '남의 업장' }).expect(404);
    });

    it('급여가 확정된 달은 요청·승인 모두 PAYROLL_LOCKED', async () => {
      const r = await create(minji.auth, { type: 'IN', reason: '위치가 안 잡혀요' }).expect(201);
      const month = today.slice(0, 7);
      const lock = await prisma.payroll.create({
        data: {
          employeeId: minjiId,
          month: monthStart(month),
          workHours: 0,
          nightHours: 0,
          baseAmount: 0,
          nightAmount: 0,
          weeklyAmount: 0,
          totalAmount: 0,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });
      try {
        const a = await http
          .post(api(`/properties/${pid}/staff/clock-requests/${r.body.id}/approve`))
          .set(owner.auth)
          .expect(409);
        expect(a.body.errorCode).toBe('PAYROLL_LOCKED');
        expect((await prisma.clockRequest.findUniqueOrThrow({ where: { id: r.body.id } })).status).toBe('PENDING');
        await prisma.clockRequest.delete({ where: { id: r.body.id } });
        const c = await create(minji.auth, { type: 'IN', reason: '위치가 안 잡혀요' }).expect(409);
        expect(c.body.errorCode).toBe('PAYROLL_LOCKED');
      } finally {
        await prisma.payroll.delete({ where: { id: lock.id } });
      }
      expect(await prisma.attendance.count({ where: { employeeId: minjiId, workDate: dateOnly(today) } })).toBe(0);
    });

    it('매니저는 자기 요청을 승인할 수 없고(사장님은 됨), 자기 요청 알림은 받지 않는다', async () => {
      const r = await create(manager.auth, { type: 'IN', reason: '위치가 안 잡혀요' }).expect(201);
      expect(push.to('shared-token-aaaaaaaaaaa')).toHaveLength(0);
      expect(push.to('owner-token-aaaaaaaaaaaa')).toHaveLength(1);
      const self = await http
        .post(api(`/properties/${pid}/staff/clock-requests/${r.body.id}/approve`))
        .set(manager.auth)
        .expect(403);
      expect(self.body.errorCode).toBe('SELF_EDIT_FORBIDDEN');
      await http
        .post(api(`/properties/${pid}/staff/clock-requests/${r.body.id}/reject`))
        .set(manager.auth)
        .send({ reason: '내 요청' })
        .expect(403);
      await http
        .post(api(`/properties/${pid}/staff/clock-requests/${r.body.id}/approve`))
        .set(owner.auth)
        .expect(200);
      await prisma.attendance.deleteMany({ where: { employeeId: managerEmpId } });
    });
  });

  describe('앱 푸시 — 알림 설정 · 무효 토큰', () => {
    beforeEach(() => push.clear());

    it('알림 설정에서 그 종류 앱 푸시를 끈 사람에게는 보내지 않는다 (앱 알림은 만든다)', async () => {
      await prisma.notificationSetting.create({
        data: { userId: owner.userId, propertyId: pid, kind: 'STAFF', push: false },
      });
      try {
        await prisma.clockRequest.deleteMany({ where: { propertyId: pid } });
        await resetMinji();
        await http
          .post(api(`/properties/${pid}/staff/clock-requests`))
          .set(minji.auth)
          .send({ type: 'IN', reason: '위치가 안 잡혀요' })
          .expect(201);
        expect(push.to('owner-token-aaaaaaaaaaaa')).toHaveLength(0);
        expect(push.to('shared-token-aaaaaaaaaaa')).toHaveLength(1);
        const noti = await http
          .get(api(`/notifications?propertyId=${pid}`))
          .set(owner.auth)
          .expect(200);
        expect(noti.body.items[0].text).toContain('출근 요청');
      } finally {
        await prisma.notificationSetting.deleteMany({ where: { userId: owner.userId, propertyId: pid } });
      }
    });

    it('FCM 이 무효라고 한 토큰은 지운다', async () => {
      await http
        .post(api('/devices'))
        .set(owner.auth)
        .send({ platform: 'IOS', token: 'dead-token-aaaaaaaaaaaaa' })
        .expect(200);
      await prisma.clockRequest.deleteMany({ where: { propertyId: pid } });
      await http
        .post(api(`/properties/${pid}/staff/clock-requests`))
        .set(minji.auth)
        .send({ type: 'IN', reason: '위치가 안 잡혀요' })
        .expect(201);
      expect(push.to('dead-token-aaaaaaaaaaaaa')).toHaveLength(1);
      expect(await prisma.device.count({ where: { token: 'dead-token-aaaaaaaaaaaaa' } })).toBe(0);
      expect(await prisma.device.count({ where: { token: 'owner-token-aaaaaaaaaaaa' } })).toBe(1);
    });

    it('직원은 업장 알림(사장님용)은 못 보고 자기 알림만 본다', async () => {
      const list = await http.get(api('/notifications')).set(minji.auth).expect(200);
      expect(list.body.items.every((n: { text: string }) => !n.text.includes('요청을 보냈어요'))).toBe(true);
    });
  });
});
