import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createAdminUser } from '../src/admin/admin-auth.service.js';
import type { BillingService as BillingServiceT } from '../src/billing/billing.service.js';
import type { FakePaymentGateway as FakePaymentGatewayT } from '../src/billing/payment-gateway.js';
import { isValidBizNo } from '../src/common/utils/biz-no.js';
import { addDaysIso, addMonths, dateOnly, kstDate } from '../src/common/utils/dates.js';
import type { ChannelConnector as ChannelConnectorT } from '../src/connectors/channel-connector.js';
import type { PrismaService as PrismaServiceT } from '../src/prisma/prisma.service.js';
import type { ConsoleSmsSender as ConsoleSmsSenderT } from '../src/sms/sms-sender.js';

/**
 * 리뷰에서 확인된 결함들의 재현 → 고친 뒤 동작 (동시 요청·결제·출퇴근·급여·권한·입력 검증)
 * 무료 체험 일수(TRIAL_DAYS)를 바꿔 띄우므로 AppModule 은 env 를 정한 뒤 불러온다.
 */
function validBizNo(prefix: string): string {
  for (let d = 0; d <= 9; d++) if (isValidBizNo(prefix + d)) return prefix + d;
  throw new Error('no');
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('결함 수정 확인 (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaServiceT;
  let sms: ConsoleSmsSenderT;
  const api = (p: string) => `/api/v1${p}`;
  type Auth = { Authorization: string };

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
    return {
      auth: { Authorization: `Bearer ${res.body.accessToken}` } as Auth,
      refresh: res.body.refreshToken as string,
      userId: res.body.user.id as string,
    };
  }

  async function property(owner: Auth, prefix: string, name: string) {
    const p = await http
      .post(api('/properties'))
      .set(owner)
      .send({ name, type: 'HOTEL', address: '서울 중구', rooms: 10, bizNo: validBizNo(prefix), ownerName: '사장' })
      .expect(201);
    return p.body.id as string;
  }

  let owner: Awaited<ReturnType<typeof signup>>;
  let pid: string;
  const o = () => owner.auth;

  beforeAll(async () => {
    process.env.TRIAL_DAYS = '56';
    process.env.WEB_ORIGIN = 'https://app.woojoo.test,https://www.woojoo.test';
    const { AppModule } = await import('../src/app.module.js');
    const { setupApp } = await import('../src/setup-app.js');
    const { PrismaService } = await import('../src/prisma/prisma.service.js');
    const { ConsoleSmsSender } = await import('../src/sms/sms-sender.js');
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(m.createNestApplication());
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    sms = app.get(ConsoleSmsSender);
    owner = await signup('010-8200-0001', '사장');
    pid = await property(o(), '323456789', '결함호텔');
  });

  afterAll(async () => {
    delete process.env.TRIAL_DAYS;
    delete process.env.WEB_ORIGIN;
    await app.close();
  });

  describe('인증 — 문자 남용 · 리프레시 토큰 경쟁', () => {
    it('같은 번호·목적은 1분에 한 번, 하루 10번까지', async () => {
      const phone = '010-8200-0100';
      await http.post(api('/auth/phone/send-code')).send({ phone, purpose: 'signup' }).expect(200);
      const again = await http.post(api('/auth/phone/send-code')).send({ phone, purpose: 'signup' }).expect(429);
      expect(again.body.errorCode).toBe('SMS_COOLDOWN');
      expect(again.body.message).toMatch(/초 뒤에 다시/);
      // 오늘 이미 10번 받았다고 치고 (1분은 지난 상태)
      await prisma.phoneVerification.updateMany({
        where: { phone: '01082000100' },
        data: { createdAt: new Date(Date.now() - 61_000) },
      });
      await prisma.phoneVerification.createMany({
        data: Array.from({ length: 9 }, () => ({
          phone: '01082000100',
          purpose: 'SIGNUP' as const,
          codeHash: 'x',
          expiresAt: new Date(),
          createdAt: new Date(Date.now() - 61_000),
        })),
      });
      const capped = await http.post(api('/auth/phone/send-code')).send({ phone, purpose: 'signup' }).expect(429);
      expect(capped.body.errorCode).toBe('SMS_DAILY_LIMIT');
    });

    it('동시에 두 번 보내도 문자는 한 번', async () => {
      const phone = '010-8200-0101';
      const before = sms.outbox.filter((m) => m.phone === '01082000101').length;
      const rs = await Promise.all(
        [0, 1, 2].map(() => http.post(api('/auth/phone/send-code')).send({ phone, purpose: 'signup' })),
      );
      expect(rs.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 429, 429]);
      expect(sms.outbox.filter((m) => m.phone === '01082000101').length).toBe(before + 1);
    });

    it('같은 리프레시 토큰으로 동시에 갱신하면 한쪽만 성공', async () => {
      const login = await http
        .post(api('/auth/login'))
        .send({ phone: '010-8200-0001', password: 'woojoo1234' })
        .expect(200);
      const rs = await Promise.all(
        [0, 1].map(() => http.post(api('/auth/refresh')).send({ refreshToken: login.body.refreshToken })),
      );
      expect(rs.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 401]);
    });
  });

  describe('입력 검증 · DB 오류', () => {
    it('달력에 없는 날짜 · uuid 아닌 값은 400', async () => {
      await http
        .get(api(`/properties/${pid}/dashboard?date=2026-13-45`))
        .set(o())
        .expect(400);
      await http
        .get(api(`/properties/${pid}/ledger?date=2026-02-31`))
        .set(o())
        .expect(400);
      await http
        .get(api(`/properties/${pid}/ledger?month=2026-13`))
        .set(o())
        .expect(400);
      await http
        .post(api(`/properties/${pid}/expenses`))
        .set(o())
        .send({ date: '2026-02-31', vendor: 'x', category: 'ETC', amount: 100 })
        .expect(400);
      await http
        .get(api(`/properties/${pid}/expenses?month=2026-00`))
        .set(o())
        .expect(400);
      await http.get(api('/notifications?propertyId=abc')).set(o()).expect(400);
      await http
        .post(api(`/properties/${pid}/staff/payroll/2026-13/calculate`))
        .set(o())
        .expect(400);
    });

    it('동시에 같은 호수를 등록하면 409 (500 이 아님)', async () => {
      const rs = await Promise.all(
        [0, 1, 2].map(() =>
          http
            .post(api(`/properties/${pid}/rooms`))
            .set(o())
            .send({ rooms: [{ number: '777' }] }),
        ),
      );
      expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
      for (const r of rs.filter((x) => x.status !== 201)) {
        expect(r.status).toBe(409);
        expect(['ROOM_NO_TAKEN', 'CONFLICT']).toContain(r.body.errorCode);
      }
    });
  });

  describe('운영자 권한', () => {
    it('사용 중지된 운영자 토큰은 바로 막히고, 권한은 DB 기준 · 자기 계정은 못 바꾼다', async () => {
      await createAdminUser(prisma, { email: 'h1@x.kr', name: 'h1', password: 'Abcdef123!@', role: 'SUPER' });
      await createAdminUser(prisma, { email: 'h2@x.kr', name: 'h2', password: 'Abcdef123!@', role: 'SUPER' });
      const l1 = await http.post(api('/admin/auth/login')).send({ email: 'h1@x.kr', password: 'Abcdef123!@' });
      const l2 = await http.post(api('/admin/auth/login')).send({ email: 'h2@x.kr', password: 'Abcdef123!@' });
      const a1 = { Authorization: `Bearer ${l1.body.accessToken}` };
      const a2 = { Authorization: `Bearer ${l2.body.accessToken}` };
      await http
        .patch(api(`/admin/properties/${pid}/manager`))
        .set(a1)
        .send({ managerId: 'zzz' })
        .expect(400);
      // 토큰은 SUPER 지만 DB 에서 OPERATOR 로 내리면 최고 관리자 API 불가
      await prisma.adminUser.update({ where: { id: l2.body.admin.id }, data: { role: 'OPERATOR' } });
      const mk = await http
        .post(api('/admin/admins'))
        .set(a2)
        .send({ email: 'h3@x.kr', name: 'h3', password: 'Abcdef123!@' })
        .expect(403);
      expect(mk.body.errorCode).toBe('ADMIN_FORBIDDEN');
      await http
        .post(api(`/admin/admins/${l2.body.admin.id}/deactivate`))
        .set(a1)
        .expect(200);
      await http.get(api('/admin/admins')).set(a2).expect(401);
      const self = await http
        .post(api(`/admin/admins/${l1.body.admin.id}/activate`))
        .set(a1)
        .expect(403);
      expect(self.body.errorCode).toBe('ADMIN_SELF');
    });
  });

  describe('직원 연결 · 출퇴근 · 급여 · 계약서', () => {
    it('직원을 먼저 등록하고 나중에 초대를 수락해도 앱 계정과 연결된다 · 초대 링크는 절대 주소', async () => {
      const e = await http
        .post(api(`/properties/${pid}/staff/employees`))
        .set(o())
        .send({
          name: '이직원',
          phone: '010-8200-0002',
          jobRole: 'FRONT',
          payType: 'HOURLY',
          payAmount: 11_000,
          hiredDate: '2026-10-01',
        })
        .expect(201);
      expect(e.body.userId).toBeNull();
      // 같은 번호로 두 번 초대하면 대기 초대는 하나만 남는다
      await http
        .post(api(`/properties/${pid}/invitations`))
        .set(o())
        .send({ phone: '010-8200-0002', role: 'STAFF' })
        .expect(201);
      const inv = await http
        .post(api(`/properties/${pid}/invitations`))
        .set(o())
        .send({ phone: '010-8200-0002', role: 'STAFF' })
        .expect(201);
      const pending = await http
        .get(api(`/properties/${pid}/members`))
        .set(o())
        .expect(200);
      expect(pending.body.invitations.filter((i: { phone: string }) => i.phone.endsWith('0002'))).toHaveLength(1);
      expect(sms.lastTo('01082000002')).toContain(`https://app.woojoo.test/app/invite?token=${inv.body.devToken}`);
      const staff = await signup('010-8200-0002', '이직원');
      await http.post(api('/invitations/accept')).set(staff.auth).send({ token: inv.body.devToken }).expect(200);
      const me = await http
        .get(api(`/properties/${pid}/staff/me`))
        .set(staff.auth)
        .expect(200);
      expect(me.body.employee.id).toBe(e.body.id);
      // 수락하면 대기 초대가 사라지고, 이미 구성원인 번호는 다시 초대할 수 없다
      const after = await http
        .get(api(`/properties/${pid}/members`))
        .set(o())
        .expect(200);
      expect(after.body.invitations.filter((i: { phone: string }) => i.phone.endsWith('0002'))).toHaveLength(0);
      const again = await http
        .post(api(`/properties/${pid}/invitations`))
        .set(o())
        .send({ phone: '010-8200-0002', role: 'STAFF' })
        .expect(409);
      expect(again.body.errorCode).toBe('ALREADY_MEMBER');
      await http
        .post(api(`/properties/${pid}/staff/attendance/clock`))
        .set(staff.auth)
        .send({ employeeId: e.body.id, action: 'in' })
        .expect(200);
    });

    it('직원 번호를 고치면 그 번호의 구성원 계정과 연결된다', async () => {
      const e = await http
        .post(api(`/properties/${pid}/staff/employees`))
        .set(o())
        .send({
          name: '번호오타',
          phone: '010-8200-0098',
          jobRole: 'FRONT',
          payType: 'HOURLY',
          payAmount: 11_000,
          hiredDate: '2026-10-01',
        })
        .expect(201);
      const fixed = await http
        .patch(api(`/properties/${pid}/staff/employees/${e.body.id}`))
        .set(o())
        .send({ phone: '010-8200-0001' }) // 사장님 본인 번호 (구성원)
        .expect(200);
      expect(fixed.body.userId).toBe(owner.userId);
    });

    it('어제 퇴근을 안 찍었으면 오늘은 새로 출근 · 30시간 근무가 생기지 않는다 · 퇴근 누락 표시', async () => {
      const e = await http
        .post(api(`/properties/${pid}/staff/employees`))
        .set(o())
        .send({
          name: '깜빡',
          phone: '010-8200-0004',
          jobRole: 'FRONT',
          payType: 'HOURLY',
          payAmount: 10_320,
          hiredDate: '2026-10-01',
        })
        .expect(201);
      const y = addDaysIso(kstDate(), -1);
      await prisma.attendance.create({
        data: { employeeId: e.body.id, workDate: dateOnly(y), clockInAt: new Date(Date.now() - 20 * 3_600_000) },
      });
      const out = await http
        .post(api(`/properties/${pid}/staff/attendance/clock`))
        .set(o())
        .send({ employeeId: e.body.id, action: 'out' })
        .expect(400);
      expect(out.body.errorCode).toBe('NOT_CLOCKED_IN');
      const ov = await http
        .get(api(`/properties/${pid}/staff`))
        .set(o())
        .expect(200);
      expect(ov.body.missingClockOut).toEqual([expect.objectContaining({ employeeId: e.body.id, date: y })]);
      const inn = await http
        .post(api(`/properties/${pid}/staff/attendance/clock`))
        .set(o())
        .send({ employeeId: e.body.id, action: 'in' })
        .expect(200);
      expect(inn.body.workDate.slice(0, 10)).toBe(kstDate());
      const done = await http
        .post(api(`/properties/${pid}/staff/attendance/clock`))
        .set(o())
        .send({ employeeId: e.body.id, action: 'out' })
        .expect(200);
      expect(new Date(done.body.clockOutAt).getTime() - new Date(done.body.clockInAt).getTime()).toBeLessThan(60_000);
    });

    it('동시에 출근을 여러 번 눌러도 한 번만 기록, 나머지는 409', async () => {
      const e = await http
        .post(api(`/properties/${pid}/staff/employees`))
        .set(o())
        .send({
          name: '동시',
          phone: '010-8200-0003',
          jobRole: 'FRONT',
          payType: 'HOURLY',
          payAmount: 11_000,
          hiredDate: '2026-10-01',
        })
        .expect(201);
      const rs = await Promise.all(
        Array.from({ length: 4 }, () =>
          http
            .post(api(`/properties/${pid}/staff/attendance/clock`))
            .set(o())
            .send({ employeeId: e.body.id, action: 'in' }),
        ),
      );
      expect(rs.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409, 409, 409]);
      expect(rs.filter((r) => r.status === 409).every((r) => r.body.errorCode === 'ALREADY_CLOCKED_IN')).toBe(true);
    });

    it('월급제 — 그 달 이후 입사자는 급여 없음, 중간 입사는 일할', async () => {
      const month = kstDate().slice(0, 7);
      const future = addMonths(month, 4);
      await http
        .post(api(`/properties/${pid}/staff/employees`))
        .set(o())
        .send({
          name: '미래입사',
          phone: '010-8200-0005',
          jobRole: 'MANAGER',
          payType: 'MONTHLY',
          payAmount: 2_500_000,
          hiredDate: `${future}-01`,
        })
        .expect(201);
      await http
        .post(api(`/properties/${pid}/staff/employees`))
        .set(o())
        .send({
          name: '중간입사',
          phone: '010-8200-0006',
          jobRole: 'MANAGER',
          payType: 'MONTHLY',
          payAmount: 3_000_000,
          hiredDate: '2026-09-16',
        })
        .expect(201);
      const r = await http
        .post(api(`/properties/${pid}/staff/payroll/2026-09/calculate`))
        .set(o())
        .expect(200);
      expect(r.body.items.find((i: { name: string }) => i.name === '미래입사')).toBeUndefined();
      expect(r.body.items.find((i: { name: string }) => i.name === '중간입사').total).toBe(1_500_000);
    });

    it('최저시급 미만이면 근로계약서를 보낼 수 없다', async () => {
      const e = await http
        .post(api(`/properties/${pid}/staff/employees`))
        .set(o())
        .send({
          name: '저시급',
          phone: '010-8200-0007',
          jobRole: 'FRONT',
          payType: 'HOURLY',
          payAmount: 9_000,
          hiredDate: '2026-10-01',
        })
        .expect(201);
      const r = await http
        .post(api(`/properties/${pid}/staff/employees/${e.body.id}/contract`))
        .set(o())
        .expect(400);
      expect(r.body.errorCode).toBe('BELOW_MINIMUM_WAGE');
    });

    it('매니저는 자기 직원 기록(급여·출퇴근)을 고칠 수 없다', async () => {
      const inv = await http
        .post(api(`/properties/${pid}/invitations`))
        .set(o())
        .send({ phone: '010-8200-0008', role: 'MANAGER' })
        .expect(201);
      const mgr = await signup('010-8200-0008', '매니저');
      await http.post(api('/invitations/accept')).set(mgr.auth).send({ token: inv.body.devToken }).expect(200);
      const e = await http
        .post(api(`/properties/${pid}/staff/employees`))
        .set(o())
        .send({
          name: '매니저',
          phone: '010-8200-0008',
          jobRole: 'MANAGER',
          payType: 'HOURLY',
          payAmount: 12_000,
          hiredDate: '2026-10-01',
        })
        .expect(201);
      expect(e.body.userId).toBe(mgr.userId);
      const pay = await http
        .patch(api(`/properties/${pid}/staff/employees/${e.body.id}`))
        .set(mgr.auth)
        .send({ payAmount: 50_000 })
        .expect(403);
      expect(pay.body.errorCode).toBe('SELF_EDIT_FORBIDDEN');
      await http
        .put(api(`/properties/${pid}/staff/attendance`))
        .set(mgr.auth)
        .send({ employeeId: e.body.id, workDate: kstDate(), clockIn: '09:00', clockOut: '23:00' })
        .expect(403);
      // 사장님은 고칠 수 있다
      await http
        .patch(api(`/properties/${pid}/staff/employees/${e.body.id}`))
        .set(o())
        .send({ payAmount: 12_500 })
        .expect(200);
    });
  });

  describe('지출 — 두 번 눌러도 지출은 하나 · 영수증 파일 확인', () => {
    it('사진인 척한 파일은 거절, 내려줄 때 nosniff · inline', async () => {
      await http
        .post(api(`/properties/${pid}/receipts`))
        .set(o())
        .attach('file', Buffer.from('<html>fake</html>'), { filename: 'r.png', contentType: 'image/png' })
        .expect(400);
      const up = await http
        .post(api(`/properties/${pid}/receipts`))
        .set(o())
        .attach('file', PNG, { filename: '영수증.png', contentType: 'image/png' })
        .expect(201);
      const f = await http
        .get(api(`/properties/${pid}/receipts/${up.body.id}/file`))
        .set(o())
        .expect(200);
      expect(f.headers['x-content-type-options']).toBe('nosniff');
      expect(f.headers['content-disposition']).toBe(`inline; filename*=UTF-8''${encodeURIComponent('영수증.png')}`);
      expect(f.headers['content-type']).toContain('image/png');

      const body = { date: kstDate(), vendor: '다이소', category: 'AMENITY', amount: 12_000 };
      const rr = await Promise.all(
        [0, 1, 2].map(() =>
          http
            .post(api(`/properties/${pid}/receipts/${up.body.id}/register`))
            .set(o())
            .send(body),
        ),
      );
      expect(rr.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409, 409]);
      const ord = await http
        .post(api(`/properties/${pid}/orders`))
        .set(o())
        .send({ item: '수건', qty: 10, unit: '장', vendor: '린넨', amount: 50_000 })
        .expect(201);
      const ro = await Promise.all(
        [0, 1, 2].map(() =>
          http
            .patch(api(`/properties/${pid}/orders/${ord.body.id}`))
            .set(o())
            .send({ status: 'RECEIVED' }),
        ),
      );
      expect(ro.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409, 409]);
      const exp = await prisma.expense.findMany({ where: { propertyId: pid } });
      expect(exp.filter((x) => x.source === 'RECEIPT')).toHaveLength(1);
      expect(exp.filter((x) => x.source === 'ORDER')).toHaveLength(1);
    });

    it('지난달 같은 날까지 합계도 준다', async () => {
      const m = await http
        .get(api(`/properties/${pid}/expenses`))
        .set(o())
        .expect(200);
      expect(m.body.prevTotalToDate).toBeLessThanOrEqual(m.body.prevTotal);
      const prev = await http
        .get(api(`/properties/${pid}/expenses?month=${addMonths(kstDate().slice(0, 7), -1)}`))
        .set(o())
        .expect(200);
      expect(prev.body.prevTotalToDate).toBe(prev.body.prevTotal);
    });
  });

  describe('객실 상태 — 다른 사람이 먼저 바꿨으면 409', () => {
    it('보고 있던 상태가 다르면 덮어쓰지 않는다', async () => {
      await http
        .post(api(`/properties/${pid}/rooms`))
        .set(o())
        .send({ rooms: [{ number: '501' }] })
        .expect(201);
      const board = await http
        .get(api(`/properties/${pid}/ops`))
        .set(o())
        .expect(200);
      const room = board.body.rooms.find((r: { number: string }) => r.number === '501');
      await http
        .patch(api(`/properties/${pid}/rooms/${room.id}/status`))
        .set(o())
        .send({ status: 'DIRTY', expectedStatus: 'READY' })
        .expect(200);
      const stale = await http
        .patch(api(`/properties/${pid}/rooms/${room.id}/status`))
        .set(o())
        .send({ status: 'CLEANING', expectedStatus: 'READY' })
        .expect(409);
      expect(stale.body.errorCode).toBe('ROOM_STATUS_CONFLICT');
      const rs = await Promise.all(
        (['CLEANING', 'INSPECT', 'READY'] as const).map((status) =>
          http
            .patch(api(`/properties/${pid}/rooms/${room.id}/status`))
            .set(o())
            .send({ status }),
        ),
      );
      expect(rs.every((r) => r.status === 200 || r.status === 409)).toBe(true);
      const logs = await http
        .get(api(`/properties/${pid}/rooms/${room.id}/logs`))
        .set(o())
        .expect(200);
      expect(logs.body).toHaveLength(1 + rs.filter((r) => r.status === 200).length);
    });
  });

  describe('채널 수집 · 리뷰 답글', () => {
    let channelPid: string;
    let connector: ChannelConnectorT;

    beforeAll(async () => {
      const { ChannelConnector } = await import('../src/connectors/channel-connector.js');
      connector = app.get(ChannelConnector);
      channelPid = await property(o(), '423456789', '채널호텔');
    });

    it('동시에 수집해도 정산이 겹쳐 쌓이지 않고, 직접 넣은 광고비는 그대로', async () => {
      await http
        .post(api(`/properties/${channelPid}/channels/YANOLJA/connect`))
        .set(o())
        .send({ loginId: 'a', password: 'b', consent: true })
        .expect(200);
      const month = kstDate().slice(0, 7);
      await http
        .put(api(`/properties/${channelPid}/ledger/ad-spend`))
        .set(o())
        .send({ channel: 'YANOLJA', month, amount: 77_000 })
        .expect(200);
      const before = await prisma.settlement.count({ where: { propertyId: channelPid } });
      const rs = await Promise.all(
        [0, 1, 2, 3].map(() => http.post(api(`/properties/${channelPid}/channels/YANOLJA/sync`)).set(o())),
      );
      expect(rs.every((r) => r.status === 200)).toBe(true);
      expect(await prisma.settlement.count({ where: { propertyId: channelPid } })).toBe(before);
      const ad = await prisma.adSpend.findFirst({
        where: { propertyId: channelPid, channel: 'YANOLJA', month: dateOnly(`${month}-01`) },
      });
      expect(ad).toMatchObject({ amount: 77_000, source: 'MANUAL' });
      const l = await http
        .get(api(`/properties/${channelPid}/ledger`))
        .set(o())
        .expect(200);
      expect(l.body.prevSalesToDate).toBeLessThanOrEqual(l.body.prevSales);
      expect(l.body.prevSalesToDate).toBeGreaterThan(0);
    });

    it('API 채널(호텔스닷컴) 답글 — 실패하면 되돌리고, 동시에 두 번 눌러도 한 번만 게시', async () => {
      await http
        .post(api(`/properties/${channelPid}/channels/HOTELS/connect`))
        .set(o())
        .send({ loginId: 'a', password: 'b', consent: true })
        .expect(200);
      const list = await http
        .get(api(`/properties/${channelPid}/reviews?channel=HOTELS`))
        .set(o())
        .expect(200);
      const rev = list.body.items[0];
      expect(rev.replyMode).toBe('API');
      // 외국어 리뷰 → 영어 템플릿
      expect(rev.draft).toMatchObject({ generator: 'template' });
      expect(rev.draft.text).toMatch(/^Thank you/);
      const redraft = await http
        .post(api(`/properties/${channelPid}/reviews/${rev.id}/draft`))
        .set(o())
        .expect(200);
      expect(redraft.body.draft.text).not.toBe(rev.draft.text);

      const orig = connector.postReply.bind(connector);
      connector.postReply = () => Promise.reject(new Error('채널 서버 오류'));
      // 채널 서버 오류는 우리 오류(500)가 아니라 502 CHANNEL_POST_FAILED
      const failed = await http
        .post(api(`/properties/${channelPid}/reviews/${rev.id}/reply`))
        .set(o())
        .send({ text: 'Thanks!' })
        .expect(502);
      expect(failed.body.errorCode).toBe('CHANNEL_POST_FAILED');
      expect((await prisma.review.findUniqueOrThrow({ where: { id: rev.id } })).status).toBe('UNANSWERED');

      let posts = 0;
      connector.postReply = async (...a: Parameters<typeof orig>) => {
        posts++;
        await new Promise((r) => setTimeout(r, 80));
        return orig(...a);
      };
      try {
        const rp = await Promise.all(
          [0, 1].map(() =>
            http
              .post(api(`/properties/${channelPid}/reviews/${rev.id}/reply`))
              .set(o())
              .send({ text: 'Thank you!' }),
          ),
        );
        expect(rp.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
        expect(rp.find((r) => r.status === 409)?.body.errorCode).toBe('ALREADY_ANSWERED');
        expect(posts).toBe(1);
        expect(rp.find((r) => r.status === 201)?.body.reply.via).toBe('API');
      } finally {
        connector.postReply = orig;
      }
    });
  });

  describe('구독 · 결제', () => {
    let billing: BillingServiceT;
    let pg: FakePaymentGatewayT;
    let bpid: string;

    beforeAll(async () => {
      const { BillingService } = await import('../src/billing/billing.service.js');
      const { FakePaymentGateway } = await import('../src/billing/payment-gateway.js');
      billing = app.get(BillingService);
      pg = app.get(FakePaymentGateway);
      bpid = await property(o(), '523456789', '결제호텔');
    });

    it('무료 체험 일수는 TRIAL_DAYS (여기서는 56일)', async () => {
      const b = await http
        .get(api(`/properties/${bpid}/billing`))
        .set(o())
        .expect(200);
      expect(b.body.trialEnds).toBe(addDaysIso(kstDate(), 56));
    });

    it('달 중간에 켠 서비스가 다른 구독의 정기결제를 막지 않고, 껐다 켜도 다시 결제하지 않는다', async () => {
      await prisma.subscription.updateMany({
        where: { propertyId: bpid },
        data: { trialEndsAt: dateOnly('2026-10-20'), status: 'ACTIVE', paidMonth: dateOnly('2026-10-01') },
      });
      await http
        .post(api(`/properties/${bpid}/payment-method`))
        .set(o())
        .send({ authKey: 'ok' })
        .expect(200);
      const c0 = pg.charges.length;
      await billing.setPlan(bpid, 'STAFF', true, '2026-11-05'); // 직원관리만 바로 결제
      expect(pg.charges.slice(c0).map((c) => c.amount)).toEqual([19_000]);
      expect(await billing.billProperty(bpid, '2026-11-20')).toEqual({ amount: 29_000 + 39_000, ok: true });
      for (const day of ['2026-11-21', '2026-11-22']) {
        await billing.setPlan(bpid, 'STAFF', false, day);
        await billing.setPlan(bpid, 'STAFF', true, day);
      }
      expect(await billing.billProperty(bpid, '2026-11-25')).toBeNull();
      const charges = pg.charges.slice(c0);
      expect(charges.map((c) => c.amount)).toEqual([19_000, 68_000]);
      // 멱등 키 = 주문번호: 업장·달·종류·순번
      const hex = bpid.replace(/-/g, '');
      expect(charges.map((c) => c.idempotencyKey)).toEqual([`wj-${hex}-202611-STAFF-1`, `wj-${hex}-202611-M-1`]);
      const b = await http
        .get(api(`/properties/${bpid}/billing`))
        .set(o())
        .expect(200);
      expect(b.body.subscriptions.every((s: { paidMonth: string }) => s.paidMonth === '2026-11')).toBe(true);
    });

    it('결제 직후 기록 전에 서버가 죽어 다시 결제해도 PG 는 한 번만 승인 (같은 멱등 키)', async () => {
      // 12월 결제를 PG 는 승인했는데 우리 DB 에는 남지 않은 상황
      await billing.billProperty(bpid, '2026-12-20');
      const c1 = pg.charges.length;
      const last = await prisma.payment.findFirstOrThrow({ where: { propertyId: bpid }, orderBy: { paidAt: 'desc' } });
      await prisma.payment.delete({ where: { id: last.id } });
      await prisma.subscription.updateMany({
        where: { propertyId: bpid },
        data: { paidMonth: dateOnly('2026-11-01') },
      });
      expect(await billing.billProperty(bpid, '2026-12-20')).toMatchObject({ ok: true });
      expect(pg.charges.length).toBe(c1);
      expect(await prisma.payment.count({ where: { propertyId: bpid, orderNo: last.orderNo } })).toBe(1);
    });

    it('결제 실패 상태에서 카드를 동시에 여러 번 등록해도 한 번만 결제', async () => {
      await prisma.subscription.updateMany({
        where: { propertyId: bpid, status: { not: 'CANCELLED' } },
        data: { status: 'PAST_DUE', paidMonth: null },
      });
      const c0 = pg.charges.length;
      const rs = await Promise.all(
        [0, 1, 2].map((i) =>
          http
            .post(api(`/properties/${bpid}/payment-method`))
            .set(o())
            .send({ authKey: `ok${i}` }),
        ),
      );
      expect(rs.every((r) => r.status === 200)).toBe(true);
      expect(pg.charges.length - c0).toBe(1);
      expect(pg.charges.at(-1)?.amount).toBe(29_000 + 39_000 + 19_000);
    });
  });
  describe('초대 미리보기 · 게시 중 자동 해제 · 급한 알림 문자', () => {
    it('초대 링크는 로그인 없이 업장 이름과 상태를 보여 준다', async () => {
      const inv = await http
        .post(api(`/properties/${pid}/invitations`))
        .set(o())
        .send({ phone: '010-8300-0001', role: 'STAFF' })
        .expect(201);
      const p1 = await http.get(api(`/invitations/${inv.body.devToken}`)).expect(200);
      expect(p1.body).toMatchObject({ role: 'STAFF', status: 'VALID', phone: '010-****-0001' });
      expect(p1.body.propertyName).toBeTruthy();
      const staff = await signup('010-8300-0001', '미리보기');
      await http.post(api('/invitations/accept')).set(staff.auth).send({ token: inv.body.devToken }).expect(200);
      const p2 = await http.get(api(`/invitations/${inv.body.devToken}`)).expect(200);
      expect(p2.body.status).toBe('USED');
      const bad = await http.get(api('/invitations/not-a-real-token')).expect(400);
      expect(bad.body.errorCode).toBe('INVITATION_INVALID');
    });

    it('10분 넘게 게시 중에 남은 리뷰만 미답변으로 되돌린다', async () => {
      const { ReviewsService } = await import('../src/reviews/reviews.service.js');
      const base = {
        propertyId: pid,
        channel: 'YANOLJA' as const,
        author: '테스트',
        rating: 5,
        body: '좋아요',
        photos: [],
        postedAt: new Date(),
        sentiment: 'POSITIVE' as const,
        status: 'POSTING' as const,
      };
      const stale = await prisma.review.create({
        data: { ...base, externalId: 'stale-1', postingAt: new Date(Date.now() - 11 * 60_000) },
      });
      const fresh = await prisma.review.create({ data: { ...base, externalId: 'fresh-1', postingAt: new Date() } });
      expect(await app.get(ReviewsService).releaseStalePosting()).toBeGreaterThanOrEqual(1);
      expect((await prisma.review.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe('UNANSWERED');
      expect((await prisma.review.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe('POSTING');
    });

    it('SMS_ALERTS_ENABLED 이면 급한 알림을 문자로도 — 알림톡을 끈 사람은 빼고', async () => {
      const { NotificationsService } = await import('../src/notifications/notifications.service.js');
      const ns = app.get(NotificationsService);
      const ownerPhone = (await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } })).phone;
      const count = () => sms.outbox.filter((m) => m.phone === ownerPhone && m.text.includes('연동이 끊겼어요')).length;
      const before = count();
      // 꺼져 있으면(기본) 문자 없음
      await ns.notifyProperty(pid, 'SYNC', '야놀자 연동이 끊겼어요.', '/app/settings/channels', { urgent: true });
      expect(count()).toBe(before);
      const cfg = (ns as unknown as { config: { get: (k: string, o?: unknown) => unknown } }).config;
      const orig = cfg.get.bind(cfg);
      cfg.get = (k: string, opt?: unknown) => (k === 'SMS_ALERTS_ENABLED' ? 'true' : orig(k, opt));
      try {
        await ns.notifyProperty(pid, 'SYNC', '야놀자 연동이 끊겼어요.', '/app/settings/channels', { urgent: true });
        expect(count()).toBe(before + 1);
        expect(sms.lastTo(ownerPhone)).toContain('/app/settings/channels');
        await prisma.notificationSetting.upsert({
          where: { userId_propertyId_kind: { userId: owner.userId, propertyId: pid, kind: 'SYNC' } },
          create: { userId: owner.userId, propertyId: pid, kind: 'SYNC', alimtalk: false },
          update: { alimtalk: false },
        });
        await ns.notifyProperty(pid, 'SYNC', '야놀자 연동이 끊겼어요.', '/app/settings/channels', { urgent: true });
        expect(count()).toBe(before + 1);
      } finally {
        cfg.get = orig;
      }
    });
  });
});
