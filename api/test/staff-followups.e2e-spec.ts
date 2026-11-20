import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { FakePaymentGateway } from '../src/billing/payment-gateway.js';
import { isValidBizNo } from '../src/common/utils/biz-no.js';
import { addDaysIso, addMonths, dateOnly, kstDate, monthStart } from '../src/common/utils/dates.js';
import { CredentialVault } from '../src/connectors/credential-vault.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';
import { weekMonday } from '../src/staff/payroll.js';

/**
 * UX 후속 (P-27 미정 · P-24/26 내 근무·급여 · P-11 직원별 이번 달 기록 · P-04 다시 결제 · P-12 퇴근 되돌리기).
 * 휴대폰 번호는 010-8910-xxxx 만 쓴다.
 */
function validBizNo(prefix: string): string {
  for (let d = 0; d <= 9; d++) if (isValidBizNo(prefix + d)) return prefix + d;
  throw new Error('no');
}

describe('알바관리 · 결제 후속 (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const api = (p: string) => `/api/v1${p}`;
  type Auth = { Authorization: string };
  type User = { auth: Auth; userId: string };

  const today = kstDate();
  const month = today.slice(0, 7);

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
      .send({ name, type: 'HOTEL', address: '대전 서구', rooms: 10, bizNo: validBizNo(prefix), ownerName: '사장' })
      .expect(201);
    return p.body.id as string;
  }

  async function employee(owner: Auth, pid: string, body: Record<string, unknown>) {
    const e = await http
      .post(api(`/properties/${pid}/staff/employees`))
      .set(owner)
      .send({ jobRole: 'FRONT', payType: 'HOURLY', payAmount: 11_000, hiredDate: addDaysIso(today, -90), ...body })
      .expect(201);
    return e.body.id as string;
  }

  const shift = (owner: Auth, pid: string, employeeId: string, workDate: string, shiftType: string) =>
    http
      .put(api(`/properties/${pid}/staff/shifts`))
      .set(owner)
      .send({ employeeId, workDate, shiftType })
      .expect(200);

  let owner: User;
  let pid: string;
  let minji: User;
  let minjiId: string;
  let coworkerId: string;
  let offId: string;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(m.createNestApplication());
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);

    owner = await signup('010-8910-0001', '후속 사장');
    pid = await property(owner.auth, '891100110', '후속 호텔');
    minjiId = await employee(owner.auth, pid, { name: '김민지', phone: '010-8910-0002' });
    minji = await signup('010-8910-0002', '김민지');
    coworkerId = await employee(owner.auth, pid, { name: '박동료', phone: '010-8910-0003' });
    offId = await employee(owner.auth, pid, { name: '최휴무', phone: '010-8910-0004' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('P-27 근무표 없는 날은 null (미정)', () => {
    it('근무표가 없으면 null, 휴무로 정한 날만 OFF — 오늘 상태는 그대로 off', async () => {
      const monday = weekMonday(today);
      let ov = await http
        .get(api(`/properties/${pid}/staff`))
        .set(owner.auth)
        .expect(200);
      expect(ov.body.week.shifts[offId]).toEqual([null, null, null, null, null, null, null]);
      expect(ov.body.today.find((t: { employeeId: string }) => t.employeeId === offId).status).toBe('off');

      await shift(owner.auth, pid, offId, monday, 'OFF');
      await shift(owner.auth, pid, offId, addDaysIso(monday, 1), 'DAY');
      ov = await http
        .get(api(`/properties/${pid}/staff`))
        .set(owner.auth)
        .expect(200);
      expect(ov.body.week.shifts[offId].slice(0, 3)).toEqual(['OFF', 'DAY', null]);

      const me = await http
        .get(api(`/properties/${pid}/staff/me`))
        .set(minji.auth)
        .expect(200);
      expect(me.body.today.shift).toBeNull();
      expect(me.body.week.shifts.every((s: string | null) => s === null)).toBe(true);
    });
  });

  describe('P-24/26 내 근무·급여 — 같이 일하는 사람 · 다음 주 · 급여 내역', () => {
    it('오늘 같이 일하는 사람 (낮·밤 근무거나 출근한 동료, 휴무·나 빼고)', async () => {
      await shift(owner.auth, pid, coworkerId, today, 'NIGHT');
      await shift(owner.auth, pid, offId, today, 'OFF');
      await shift(owner.auth, pid, minjiId, today, 'DAY');
      const me = await http
        .get(api(`/properties/${pid}/staff/me`))
        .set(minji.auth)
        .expect(200);
      expect(me.body.today.shift).toBe('DAY');
      expect(me.body.coworkers).toEqual([{ name: '박동료', shift: 'NIGHT', working: false }]);
    });

    it('다음 주 내 근무', async () => {
      const nextMonday = addDaysIso(weekMonday(today), 7);
      await shift(owner.auth, pid, minjiId, nextMonday, 'DAY');
      await shift(owner.auth, pid, minjiId, addDaysIso(nextMonday, 2), 'OFF');
      const me = await http
        .get(api(`/properties/${pid}/staff/me`))
        .set(minji.auth)
        .expect(200);
      expect(me.body.nextWeek.dates[0]).toBe(nextMonday);
      expect(me.body.nextWeek.shifts.slice(0, 4)).toEqual(['DAY', null, 'OFF', null]);
    });

    it('급여 내역은 사장님 급여 칸과 같은 숫자 (시급 × 시간 · 야간 · 주휴)', async () => {
      // 이번 달 안의 지난 날 (1일이면 오늘 기록 하나만 — 퇴근까지 직접 넣는다)
      const days = [1, 2, 3, 4].map((n) => addDaysIso(today, -n)).filter((d) => d.startsWith(month));
      for (const d of days)
        await http
          .put(api(`/properties/${pid}/staff/attendance`))
          .set(owner.auth)
          .send({ employeeId: minjiId, workDate: d, clockIn: '18:00', clockOut: '23:30', memo: '보정' })
          .expect(200);
      const ov = await http
        .get(api(`/properties/${pid}/staff`))
        .set(owner.auth)
        .expect(200);
      const ownerRow = ov.body.payroll.find((p: { employeeId: string }) => p.employeeId === minjiId);
      const me = await http
        .get(api(`/properties/${pid}/staff/me`))
        .set(minji.auth)
        .expect(200);
      expect(me.body.pay).toMatchObject({
        payType: 'HOURLY',
        rate: 11_000,
        monthly: null,
        hours: ownerRow.hours,
        base: ownerRow.base,
        nightHours: ownerRow.nightHours,
        night: ownerRow.night,
        weekly: ownerRow.weekly,
        total: ownerRow.total,
        status: null,
      });
      expect(me.body.pay.base).toBe(Math.round(me.body.pay.hours * 11_000));
      expect(me.body.pay.total).toBe(me.body.pay.base + me.body.pay.night + me.body.pay.weekly);
      expect(me.body.month.estimatedPay).toBe(me.body.pay.total);
      if (days.length) expect(me.body.pay.nightHours).toBeGreaterThan(0);
    });
  });

  describe('P-11 직원 한 명의 이번 달 기록', () => {
    it('날짜별 출퇴근 · 고친 사유 · 고친 사람 · 근무표상 결근 — 사장님·매니저만', async () => {
      const r = await http
        .get(api(`/properties/${pid}/staff/employees/${minjiId}/attendance?month=${month}`))
        .set(owner.auth)
        .expect(200);
      expect(r.body).toMatchObject({ month, employee: { id: minjiId, name: '김민지' }, locked: false });
      const edited = r.body.days.filter((d: { memo: string | null }) => d.memo === '보정');
      expect(edited.length).toBe(r.body.workedDays);
      for (const d of edited)
        expect(d).toMatchObject({
          clockIn: '18:00',
          clockOut: '23:30',
          hours: 5.5,
          edited: true,
          editedBy: '후속 사장',
          missingOut: false,
          absent: false,
        });
      // 오늘 낮 근무 — 아직 기록 없음 (오늘은 결근으로 보지 않는다)
      expect(r.body.days.find((d: { workDate: string }) => d.workDate === today)).toMatchObject({
        shift: 'DAY',
        clockIn: null,
        absent: false,
      });
      // 날짜 순
      const dates = r.body.days.map((d: { workDate: string }) => d.workDate);
      expect(dates).toEqual([...dates].sort((a: string, b: string) => a.localeCompare(b)));

      // 기본은 이번 달
      const def = await http
        .get(api(`/properties/${pid}/staff/employees/${minjiId}/attendance`))
        .set(owner.auth)
        .expect(200);
      expect(def.body.month).toBe(month);
    });

    it('지난 근무일인데 기록이 없으면 absent · 16시간 넘게 열린 기록은 missingOut', async () => {
      const day = addDaysIso(today, -6);
      if (!day.startsWith(month)) return; // 달 초에는 건너뜀
      await shift(owner.auth, pid, coworkerId, day, 'DAY');
      const two = addDaysIso(today, -5);
      await prisma.attendance.create({
        data: {
          employeeId: coworkerId,
          workDate: dateOnly(two),
          clockInAt: new Date(`${two}T09:00:00+09:00`),
        },
      });
      const r = await http
        .get(api(`/properties/${pid}/staff/employees/${coworkerId}/attendance?month=${month}`))
        .set(owner.auth)
        .expect(200);
      expect(r.body.days.find((d: { workDate: string }) => d.workDate === day)).toMatchObject({ absent: true });
      expect(r.body.days.find((d: { workDate: string }) => d.workDate === two)).toMatchObject({
        missingOut: true,
        clockOut: null,
      });
    });

    it('직원은 볼 수 없고, 다른 업장 직원·잘못된 달·앞으로 올 달은 거절', async () => {
      await http
        .get(api(`/properties/${pid}/staff/employees/${minjiId}/attendance`))
        .set(minji.auth)
        .expect(403);
      await http
        .get(api(`/properties/${pid}/staff/employees/${minjiId}/attendance?month=2026-13`))
        .set(owner.auth)
        .expect(400);
      await http
        .get(api(`/properties/${pid}/staff/employees/${minjiId}/attendance?month=${addMonths(month, 1)}`))
        .set(owner.auth)
        .expect(400);
      const other = await property(owner.auth, '891200220', '다른 호텔');
      await http
        .get(api(`/properties/${other}/staff/employees/${minjiId}/attendance`))
        .set(owner.auth)
        .expect(404);
    });
  });

  describe('P-12 퇴근 되돌리기', () => {
    const clock = (action: 'in' | 'out') =>
      http
        .post(api(`/properties/${pid}/staff/attendance/clock`))
        .set(minji.auth)
        .send({ employeeId: minjiId, action });
    const undo = (auth: Auth = minji.auth) =>
      http
        .post(api(`/properties/${pid}/staff/clock/undo-out`))
        .set(auth)
        .send({});

    it('퇴근 후 5분 안에는 본인이 되돌려 다시 근무 중으로', async () => {
      await clock('in').expect(200);
      await undo().expect(409); // 아직 퇴근 전
      await clock('out').expect(200);
      let me = await http
        .get(api(`/properties/${pid}/staff/me`))
        .set(minji.auth)
        .expect(200);
      expect(me.body.state).toBe('done');
      expect(Date.parse(me.body.undoOutUntil)).toBeGreaterThan(Date.now());
      const r = await undo().expect(200);
      expect(r.body.clockOutAt).toBeNull();
      me = await http
        .get(api(`/properties/${pid}/staff/me`))
        .set(minji.auth)
        .expect(200);
      expect(me.body).toMatchObject({ state: 'working', undoOutUntil: null });
      expect(me.body.today.out).toBeNull();
      // 사장님은 직원 명단에 없으니 되돌릴 기록이 없다
      await undo(owner.auth).expect(404);
    });

    it('5분이 지났거나, 사장님이 고친 기록이거나, 급여가 확정된 달이면 되돌리지 않는다', async () => {
      await clock('out').expect(200);
      const a = await prisma.attendance.findFirstOrThrow({ where: { employeeId: minjiId, workDate: dateOnly(today) } });
      await prisma.attendance.update({
        where: { id: a.id },
        data: { clockOutAt: new Date(Date.now() - 6 * 60_000) },
      });
      expect((await undo().expect(409)).body.errorCode).toBe('UNDO_EXPIRED');

      await prisma.attendance.update({ where: { id: a.id }, data: { clockOutAt: new Date(), editedAt: new Date() } });
      expect((await undo().expect(409)).body.errorCode).toBe('UNDO_EXPIRED');

      await prisma.attendance.update({ where: { id: a.id }, data: { clockOutAt: new Date(), editedAt: null } });
      const p = await prisma.payroll.create({
        data: {
          employeeId: coworkerId,
          month: monthStart(month),
          workHours: 0,
          nightHours: 0,
          baseAmount: 0,
          nightAmount: 0,
          weeklyAmount: 0,
          totalAmount: 0,
          status: 'CONFIRMED',
        },
      });
      expect((await undo().expect(409)).body.errorCode).toBe('PAYROLL_LOCKED');
      await prisma.payroll.delete({ where: { id: p.id } });
      await undo().expect(200);
      await clock('out').expect(200);
    });
  });

  describe('P-04 결제 실패 다시 결제', () => {
    let bpid: string;
    let pg: FakePaymentGateway;
    const retry = (auth: Auth = owner.auth) => http.post(api(`/properties/${bpid}/billing/retry`)).set(auth);

    beforeAll(async () => {
      pg = app.get(FakePaymentGateway);
      bpid = await property(owner.auth, '891300330', '결제 실패 호텔');
      await prisma.subscription.updateMany({
        where: { propertyId: bpid },
        data: { trialEndsAt: dateOnly(addDaysIso(today, -3)), status: 'PAST_DUE', paidMonth: null },
      });
    });

    it('결제 실패가 없거나 카드가 없으면 결제하지 않는다', async () => {
      const r = await retry().expect(402);
      expect(r.body.errorCode).toBe('PAYMENT_FAILED');
      expect(r.body.message).toContain('카드');
    });

    it('같은 카드로 다시 결제 — 또 실패하면 402 (알림은 다시 보내지 않음), 성공하면 정상으로', async () => {
      // 한도 초과 카드 등록 → 등록하면서 한 번 시도해 실패
      await http
        .post(api(`/properties/${bpid}/payment-method`))
        .set(owner.auth)
        .send({ authKey: 'decline-1' })
        .expect(200);
      const notices = await prisma.notification.count({ where: { propertyId: bpid } });
      const c0 = pg.charges.length;
      const fail = await retry().expect(402);
      expect(fail.body.message).toContain('한도');
      expect(pg.charges.length).toBe(c0 + 1);
      expect(await prisma.notification.count({ where: { propertyId: bpid } })).toBe(notices);
      expect(
        (await prisma.subscription.findMany({ where: { propertyId: bpid } })).every((s) => s.status === 'PAST_DUE'),
      ).toBe(true);

      // 카드사에서 한도를 풀었다 — 같은 카드(빌링키)가 이제 승인된다
      const vault = app.get(CredentialVault);
      await prisma.paymentMethod.updateMany({
        where: { propertyId: bpid, isDefault: true },
        data: { billingKey: vault.sealText('bk_restored') },
      });
      const ok = await retry().expect(200);
      expect(ok.body.retried).toEqual({ amount: 29_000 + 39_000, ok: true });
      expect(ok.body.subscriptions.every((s: { status: string }) => s.status === 'ACTIVE')).toBe(true);
      expect(ok.body.payments[0]).toMatchObject({ status: 'PAID', amount: 68_000 });
      // 주문번호(멱등 키)는 시도마다 새 순번
      const keys = pg.charges.slice(c0).map((c) => c.idempotencyKey);
      expect(new Set(keys).size).toBe(keys.length);

      // 다시 누르면 결제할 게 없다
      expect((await retry().expect(409)).body.errorCode).toBe('NO_FAILED_PAYMENT');
    });

    it('두 번 동시에 눌러도 한 번만 결제', async () => {
      await prisma.subscription.updateMany({
        where: { propertyId: bpid },
        data: { status: 'PAST_DUE', paidMonth: null },
      });
      const c0 = pg.charges.length;
      const rs = await Promise.all([retry(), retry()]);
      expect(rs.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409]);
      expect(pg.charges.length - c0).toBe(1);
    });

    it('실증 업장은 다시 결제도 하지 않고, 사장님만', async () => {
      await prisma.subscription.updateMany({
        where: { propertyId: bpid },
        data: { status: 'PAST_DUE', paidMonth: null },
      });
      await prisma.property.update({
        where: { id: bpid },
        data: { pilotGroup: '대전 1차', pilotStartedAt: dateOnly(today) },
      });
      const c0 = pg.charges.length;
      expect((await retry().expect(400)).body.errorCode).toBe('PILOT_BILLING_HELD');
      expect(pg.charges.length).toBe(c0);
      await http
        .post(api(`/properties/${pid}/billing/retry`))
        .set(minji.auth)
        .expect(403);
    });
  });
});
