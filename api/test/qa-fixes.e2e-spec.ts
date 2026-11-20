import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { BillingService } from '../src/billing/billing.service.js';
import { isValidBizNo } from '../src/common/utils/biz-no.js';
import { addDaysIso, addMonths, dateOnly, kstDate, kstHour } from '../src/common/utils/dates.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';
import { ConsoleSmsSender } from '../src/sms/sms-sender.js';
import { minimumWageFor, weekMonday } from '../src/staff/payroll.js';

/**
 * QA 점검(1차 A) 수정 확인 — 매출 기준 · 사장님 0명 경쟁 · 알림 범위 · 급여 잠금 · 출퇴근 검증 · 초대 묶음 ·
 * 문자 한도 · 오류 문구 · 직원 계정 자동 연결 · 교대표 주 이동 등.
 * 휴대폰 번호는 010-8500-xxxx 만 쓴다.
 */
function validBizNo(prefix: string): string {
  for (let d = 0; d <= 9; d++) if (isValidBizNo(prefix + d)) return prefix + d;
  throw new Error('no');
}

describe('QA 수정 확인 (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let sms: ConsoleSmsSender;
  const api = (p: string) => `/api/v1${p}`;
  type Auth = { Authorization: string };
  type User = { auth: Auth; userId: string; phone: string };

  const today = kstDate();
  const month = today.slice(0, 7);
  const lastMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);

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
    return {
      auth: { Authorization: `Bearer ${res.body.accessToken}` },
      userId: res.body.user.id as string,
      phone: phone.replace(/\D/g, ''),
    };
  }

  async function property(owner: Auth, prefix: string, name: string) {
    const p = await http
      .post(api('/properties'))
      .set(owner)
      .send({ name, type: 'HOTEL', address: '대전 서구', rooms: 10, bizNo: validBizNo(prefix), ownerName: '사장' })
      .expect(201);
    return p.body.id as string;
  }

  /** 초대 → 가입 → 수락 */
  async function member(owner: Auth, pid: string, phone: string, name: string, role: 'MANAGER' | 'STAFF') {
    const inv = await http
      .post(api(`/properties/${pid}/invitations`))
      .set(owner)
      .send({ phone, role })
      .expect(201);
    const u = await signup(phone, name);
    await http.post(api('/invitations/accept')).set(u.auth).send({ token: inv.body.devToken }).expect(200);
    return u;
  }

  async function employee(owner: Auth, pid: string, body: Record<string, unknown>) {
    const e = await http
      .post(api(`/properties/${pid}/staff/employees`))
      .set(owner)
      .send({ jobRole: 'FRONT', payType: 'HOURLY', payAmount: 11_000, hiredDate: addDaysIso(today, -90), ...body })
      .expect(201);
    return e.body.id as string;
  }

  let seq = 0;
  async function booking(propertyId: string, date: string, amount: number, commission = 0) {
    seq += 1;
    await prisma.booking.create({
      data: {
        propertyId,
        channel: 'YANOLJA',
        reservationNo: `qa-${seq}`,
        guestName: '김*',
        roomType: '더블',
        checkinDate: dateOnly(date),
        checkoutDate: dateOnly(addDaysIso(date, 1)),
        saleAmount: amount,
        commission,
        bookedAt: new Date(),
      },
    });
  }

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(m.createNestApplication());
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    sms = app.get(ConsoleSmsSender);
  });

  afterAll(async () => {
    await app.close();
  });

  it('A1 진행 중인 달 매출은 오늘 체크인까지 — 내일~말일은 upcoming, /portfolio · /report 와 같은 숫자', async () => {
    const o = await signup('010-8500-0001', '매출 사장');
    const pid = await property(o.auth, '610456789', '매출 호텔');
    await booking(pid, today, 100_000, 10_000);
    const tomorrow = addDaysIso(today, 1);
    const sameMonth = tomorrow.startsWith(month);
    if (sameMonth) await booking(pid, tomorrow, 50_000, 5_000);

    const l = await http
      .get(api(`/properties/${pid}/ledger`))
      .set(o.auth)
      .expect(200);
    expect(l.body).toMatchObject({ partial: true, asOf: today, sales: 100_000, fees: 10_000 });
    expect(l.body.upcoming).toEqual(
      sameMonth ? { sales: 50_000, bookings: 1, commission: 5_000 } : { sales: 0, bookings: 0, commission: 0 },
    );
    expect(l.body.trend.at(-1)).toEqual({ month, sales: 100_000 });
    const ex = await http
      .get(api(`/properties/${pid}/expenses`))
      .set(o.auth)
      .expect(200);
    expect(ex.body.sales).toBe(100_000);
    expect(ex.body.upcoming.sales).toBe(sameMonth ? 50_000 : 0);
    const pf = await http.get(api('/portfolio')).set(o.auth).expect(200);
    expect(pf.body.properties[0].month.sales).toBe(l.body.sales);
    const rp = await http.get(api('/portfolio/report')).set(o.auth).expect(200);
    expect(rp.body.properties[0].sales).toBe(l.body.sales);
    // 지난 달은 전체 (예정 없음)
    const past = await http
      .get(api(`/properties/${pid}/ledger?month=${lastMonth}`))
      .set(o.auth)
      .expect(200);
    expect(past.body).toMatchObject({ partial: false, upcoming: { sales: 0, bookings: 0 } });
  });

  it('A2 사장님 두 명이 동시에 서로를 내려도 사장님은 한 명 남는다', async () => {
    const a = await signup('010-8500-0010', '사장 A');
    const pid = await property(a.auth, '611456789', '공동 운영 호텔');
    const b = await member(a.auth, pid, '010-8500-0011', '사장 B', 'MANAGER');
    const list = await http
      .get(api(`/properties/${pid}/members`))
      .set(a.auth)
      .expect(200);
    type M = { id: string; userId: string };
    const mA = list.body.members.find((x: M) => x.userId === a.userId).id;
    const mB = list.body.members.find((x: M) => x.userId === b.userId).id;
    await http
      .patch(api(`/properties/${pid}/members/${mB}`))
      .set(a.auth)
      .send({ role: 'OWNER' })
      .expect(200);
    const rs = await Promise.all([
      http
        .patch(api(`/properties/${pid}/members/${mB}`))
        .set(a.auth)
        .send({ role: 'MANAGER' }),
      http
        .patch(api(`/properties/${pid}/members/${mA}`))
        .set(b.auth)
        .send({ role: 'MANAGER' }),
    ]);
    expect(rs.map((r) => r.status).sort((x, y) => x - y)).toEqual([200, 400]);
    expect(rs.find((r) => r.status === 400)?.body.errorCode).toBe('LAST_OWNER');
    expect(await prisma.membership.count({ where: { propertyId: pid, role: 'OWNER' } })).toBe(1);
  });

  it('A3 알림은 지금 사장님·매니저인 업장 것만 — 직원으로 내리면 안 보이고, 결제 실패는 사장님에게만', async () => {
    const o = await signup('010-8500-0020', '알림 사장');
    const pid = await property(o.auth, '612456789', '알림 호텔');
    const mgr = await member(o.auth, pid, '010-8500-0021', '알림 매니저', 'MANAGER');
    await app.get(NotificationsService).notifyProperty(pid, 'REVIEW', '새 리뷰가 왔어요.', '/app/reviews');
    // 체험이 끝났는데 카드가 없어 정기결제 실패
    await prisma.subscription.updateMany({
      where: { propertyId: pid },
      data: { trialEndsAt: dateOnly(addDaysIso(today, -1)) },
    });
    await app.get(BillingService).billProperty(pid, today, true);
    const kinds = async (u: Auth) =>
      (await http.get(api('/notifications')).set(u).expect(200)).body.items.map((n: { kind: string }) => n.kind);
    expect(await kinds(o.auth)).toEqual(expect.arrayContaining(['REVIEW', 'BILLING']));
    expect(await kinds(mgr.auth)).toEqual(['REVIEW']);

    const list = await http
      .get(api(`/properties/${pid}/members`))
      .set(o.auth)
      .expect(200);
    const mid = list.body.members.find((x: { userId: string }) => x.userId === mgr.userId).id;
    await http
      .patch(api(`/properties/${pid}/members/${mid}`))
      .set(o.auth)
      .send({ role: 'STAFF' })
      .expect(200);
    const after = await http.get(api('/notifications')).set(mgr.auth).expect(200);
    expect(after.body).toEqual({ unread: 0, items: [] });
    // 모두 읽음도 그 업장 알림은 건드리지 않는다 (다시 매니저가 되면 안 읽은 채로)
    await http.post(api('/notifications/read-all')).set(mgr.auth).expect(204);
    await http
      .patch(api(`/properties/${pid}/members/${mid}`))
      .set(o.auth)
      .send({ role: 'MANAGER' })
      .expect(200);
    expect((await http.get(api('/notifications')).set(mgr.auth).expect(200)).body.unread).toBe(1);
  });

  describe('알바관리 — 급여 잠금 · 출퇴근 검증 · 오늘 상태 · 퇴근 누락 · 주 이동', () => {
    let o: User;
    let pid: string;
    let eid: string;
    const d = (day: number) => `${lastMonth}-${String(day).padStart(2, '0')}`;
    const put = (body: Record<string, unknown>) =>
      http
        .put(api(`/properties/${pid}/staff/attendance`))
        .set(o.auth)
        .send({ employeeId: eid, clockIn: '09:00', clockOut: '16:00', ...body });

    beforeAll(async () => {
      o = await signup('010-8500-0030', '급여 사장');
      pid = await property(o.auth, '613456789', '급여 호텔');
      eid = await employee(o.auth, pid, {
        name: '근무자',
        phone: '010-8500-0031',
        hiredDate: `${addMonths(month, -3)}-01`,
      });
    });

    it('A11 근무일은 오늘까지 · 입사일 이후 · 출근≠퇴근 · 16시간 이하', async () => {
      const future = await put({ workDate: addDaysIso(today, 1) }).expect(400);
      expect(future.body.errorCode).toBe('WORK_DATE_FUTURE');
      const before = await put({ workDate: addDaysIso(`${addMonths(month, -3)}-01`, -1) }).expect(400);
      expect(before.body.errorCode).toBe('WORK_DATE_BEFORE_HIRED');
      const same = await put({ workDate: d(9), clockOut: '09:00' }).expect(400);
      expect(same.body.errorCode).toBe('CLOCK_SAME');
      const long = await put({ workDate: d(9), clockIn: '08:00', clockOut: '02:00' }).expect(400);
      expect(long.body.errorCode).toBe('SHIFT_TOO_LONG');
      // 야간(22시~다음 날 7시)은 그대로 된다
      await put({ workDate: d(9), clockIn: '22:00', clockOut: '07:00' }).expect(200);
      await put({ workDate: d(9) }).expect(200);
    });

    it('A5 확정 전(DRAFT) 급여는 볼 때마다 다시 계산', async () => {
      await http
        .post(api(`/properties/${pid}/staff/payroll/${lastMonth}/calculate`))
        .set(o.auth)
        .expect(200);
      const ov = async () =>
        (
          await http
            .get(api(`/properties/${pid}/staff?date=${d(15)}`))
            .set(o.auth)
            .expect(200)
        ).body.payroll[0];
      expect(await ov()).toMatchObject({ hours: 7, status: 'DRAFT' });
      await put({ workDate: d(10) }).expect(200);
      expect(await ov()).toMatchObject({ hours: 14, status: 'DRAFT' });
    });

    it('A4 퇴근 누락이 있으면 확정 불가 → 고치면 확정 → 확정된 달 출퇴근은 409', async () => {
      await put({ workDate: d(11), clockOut: undefined }).expect(200);
      const missing = await http.post(api(`/properties/${pid}/staff/payroll/${lastMonth}/confirm`)).set(o.auth);
      expect(missing.status).toBe(400);
      expect(missing.body.errorCode).toBe('MISSING_CLOCK_OUT');
      await put({ workDate: d(11) }).expect(200);
      const ok = await http
        .post(api(`/properties/${pid}/staff/payroll/${lastMonth}/confirm`))
        .set(o.auth)
        .expect(200);
      expect(ok.body.items[0]).toMatchObject({ hours: 21, status: 'CONFIRMED' });
      const locked = await put({ workDate: d(12) }).expect(409);
      expect(locked.body).toMatchObject({ errorCode: 'PAYROLL_LOCKED' });
      expect(locked.body.message).toContain('확정을 풀고');
      // 확정을 풀면 다시 고칠 수 있다
      await http
        .post(api(`/properties/${pid}/staff/payroll/${lastMonth}/reopen`))
        .set(o.auth)
        .expect(200);
      await put({ workDate: d(12) }).expect(200);
    });

    it('A4 · A6 최저임금 — 월급제는 월급 ÷ 209시간, 그 달의 해 기준', async () => {
      const p2 = await property(o.auth, '614456789', '월급 호텔');
      await employee(o.auth, p2, {
        name: '월급자',
        phone: '010-8500-0032',
        payType: 'MONTHLY',
        payAmount: 1_500_000,
        hiredDate: `${addMonths(month, -3)}-01`,
      });
      const low = await http.post(api(`/properties/${p2}/staff/payroll/${lastMonth}/confirm`)).set(o.auth);
      expect(low.status).toBe(400);
      expect(low.body.errorCode).toBe('BELOW_MINIMUM_WAGE');
      const old = await http
        .get(api(`/properties/${pid}/staff?date=2025-12-15`))
        .set(o.auth)
        .expect(200);
      expect(old.body.minimumWage).toBe(10_030);
      const now = await http
        .get(api(`/properties/${pid}/staff`))
        .set(o.auth)
        .expect(200);
      expect(now.body.minimumWage).toBe(10_320);
    });

    it('A12 앞으로 올 달은 급여 계산 · 확정 · 업장 비교 리포트 모두 400', async () => {
      for (const action of ['calculate', 'confirm']) {
        const r = await http.post(api(`/properties/${pid}/staff/payroll/${nextMonth}/${action}`)).set(o.auth);
        expect(r.status).toBe(400);
        expect(r.body.errorCode).toBe('FUTURE_MONTH');
      }
      const thisMonth = await http.post(api(`/properties/${pid}/staff/payroll/${month}/confirm`)).set(o.auth);
      expect(thisMonth.body.errorCode).toBe('MONTH_NOT_ENDED');
      const rp = await http
        .get(api(`/portfolio/report?month=${nextMonth}`))
        .set(o.auth)
        .expect(400);
      expect(rp.body.errorCode).toBe('FUTURE_MONTH');
    });

    it('A8 자정 넘긴 야간 근무는 근무 중, 오늘 근무인데 시작 전이면 근무 예정', async () => {
      const p3 = await property(o.auth, '615456789', '야간 호텔');
      const night = await employee(o.auth, p3, { name: '야간자', phone: '010-8500-0033' });
      const later = await employee(o.auth, p3, { name: '저녁조', phone: '010-8500-0034' });
      await prisma.attendance.create({
        data: {
          employeeId: night,
          workDate: dateOnly(addDaysIso(today, -1)),
          clockInAt: new Date(Date.now() - 10 * 3_600_000),
        },
      });
      await http
        .put(api(`/properties/${p3}/staff/shifts`))
        .set(o.auth)
        .send({ employeeId: later, workDate: today, shiftType: 'NIGHT' })
        .expect(200);
      const ov = await http
        .get(api(`/properties/${p3}/staff`))
        .set(o.auth)
        .expect(200);
      type T = { employeeId: string; status: string; in: string | null };
      const st = (id: string) => ov.body.today.find((t: T) => t.employeeId === id);
      expect(st(night)).toMatchObject({ status: 'working' });
      expect(st(night).in).not.toBeNull();
      expect(st(later).status).toBe(kstHour() < 22 ? 'scheduled' : 'late');
    });

    it('A7 퇴근 누락은 /portfolio 와 /staff 가 같은 기준 (퇴사자 기록 포함)', async () => {
      const p4 = await property(o.auth, '616456789', '누락 호텔');
      const gone = await employee(o.auth, p4, { name: '퇴사자', phone: '010-8500-0035' });
      const workDate = addDaysIso(today, -25);
      await prisma.attendance.create({
        data: { employeeId: gone, workDate: dateOnly(workDate), clockInAt: new Date(`${workDate}T09:00:00+09:00`) },
      });
      await http
        .patch(api(`/properties/${p4}/staff/employees/${gone}`))
        .set(o.auth)
        .send({ resignedDate: addDaysIso(today, -24) })
        .expect(200);
      const ov = await http
        .get(api(`/properties/${p4}/staff`))
        .set(o.auth)
        .expect(200);
      expect(ov.body.missingClockOut).toEqual([
        expect.objectContaining({ employeeId: gone, name: '퇴사자', date: workDate, in: '09:00' }),
      ]);
      const pf = await http.get(api('/portfolio')).set(o.auth).expect(200);
      const row = pf.body.properties.find((p: { id: string }) => p.id === p4);
      expect(row.staff.missingClockOut).toBe(ov.body.missingClockOut.length);
    });

    it('A24 교대표 주 이동 — ?week 로 그 주(월요일부터)', async () => {
      const next = addDaysIso(weekMonday(today), 7);
      const ov = await http
        .get(api(`/properties/${pid}/staff?week=${addDaysIso(next, 2)}`))
        .set(o.auth)
        .expect(200);
      expect(ov.body.week.dates[0]).toBe(next);
      expect(ov.body.week.dates).toHaveLength(7);
      expect(ov.body.date).toBe(today);
    });
  });

  it('A9 초대 묶음 — 함께 보낸 것만 함께 수락 · 미리보기는 업장별 권한 · 취소 · 다시 보내기 · 전체 번호', async () => {
    const o = await signup('010-8500-0040', '초대 사장');
    const pa = await property(o.auth, '617456789', '초대 A');
    const pb = await property(o.auth, '618456789', '초대 B');
    const pc = await property(o.auth, '619456789', '초대 C');
    const batch = await http
      .post(api('/portfolio/invitations'))
      .set(o.auth)
      .send({ phone: '010-8500-0041', role: 'MANAGER', propertyIds: [pa, pb] })
      .expect(201);
    const single = await http
      .post(api(`/properties/${pc}/invitations`))
      .set(o.auth)
      .send({ phone: '010-8500-0041', role: 'STAFF' })
      .expect(201);
    const pv = await http.get(api(`/invitations/${batch.body.devToken}`)).expect(200);
    expect(pv.body.properties).toEqual([
      { name: '초대 A', role: 'MANAGER' },
      { name: '초대 B', role: 'MANAGER' },
    ]);
    const pvSingle = await http.get(api(`/invitations/${single.body.devToken}`)).expect(200);
    expect(pvSingle.body.properties).toEqual([{ name: '초대 C', role: 'STAFF' }]);
    // 사장님은 번호 전체, 초대 id 로 업장별 취소·다시 보내기
    const people = await http.get(api('/portfolio/people')).set(o.auth).expect(200);
    expect(people.body.invitations[0]).toMatchObject({ phone: '01085000041' });
    expect(people.body.invitations[0].invitationIds).toHaveLength(people.body.invitations[0].propertyIds.length);

    const u = await signup('010-8500-0041', '초대받은 사람');
    const acc = await http.post(api('/invitations/accept')).set(u.auth).send({ token: single.body.devToken });
    expect(acc.body).toMatchObject({ propertyId: pc, joined: 1 });
    const acc2 = await http
      .post(api('/invitations/accept'))
      .set(u.auth)
      .send({ token: batch.body.devToken })
      .expect(200);
    expect(acc2.body.joined).toBe(2);

    // 취소
    const z = await http
      .post(api(`/properties/${pa}/invitations`))
      .set(o.auth)
      .send({ phone: '010-8500-0042', role: 'STAFF' })
      .expect(201);
    const members = await http
      .get(api(`/properties/${pa}/members`))
      .set(o.auth)
      .expect(200);
    const zid = members.body.invitations.find((i: { phone: string }) => i.phone === '01085000042').id;
    await http
      .delete(api(`/properties/${pa}/invitations/${zid}`))
      .set(o.auth)
      .expect(204);
    await http
      .delete(api(`/properties/${pa}/invitations/${zid}`))
      .set(o.auth)
      .expect(404);
    await http.get(api(`/invitations/${z.body.devToken}`)).expect(400);

    // 다시 보내기 — 새 링크, 예전 링크는 무효
    await http
      .post(api(`/properties/${pa}/invitations`))
      .set(o.auth)
      .send({ phone: '010-8500-0043', role: 'STAFF' })
      .expect(201);
    const m2 = await http
      .get(api(`/properties/${pa}/members`))
      .set(o.auth)
      .expect(200);
    const wid = m2.body.invitations.find((i: { phone: string }) => i.phone === '01085000043').id;
    const old = await prisma.invitation.findUniqueOrThrow({ where: { id: wid } });
    const re = await http
      .post(api(`/properties/${pa}/invitations/${wid}/resend`))
      .set(o.auth)
      .expect(200);
    expect(sms.lastTo('01085000043')).toContain(re.body.devToken);
    expect((await prisma.invitation.findUniqueOrThrow({ where: { id: wid } })).tokenHash).not.toBe(old.tokenHash);
    expect((await http.get(api(`/invitations/${re.body.devToken}`)).expect(200)).body.status).toBe('VALID');

    // 매니저에게는 가린 번호
    const mgrView = await http
      .get(api(`/properties/${pa}/members`))
      .set(u.auth)
      .expect(200);
    expect(mgrView.body.members.every((x: { phone: string }) => x.phone.includes('****'))).toBe(true);
  });

  it('A9 사장님에서 내려간 사람이 보낸 초대는 무효', async () => {
    const o = await signup('010-8500-0050', '원래 사장');
    const pid = await property(o.auth, '620456789', '권한 호텔');
    const b = await member(o.auth, pid, '010-8500-0051', '공동 사장', 'MANAGER');
    const list = await http
      .get(api(`/properties/${pid}/members`))
      .set(o.auth)
      .expect(200);
    const mb = list.body.members.find((x: { userId: string }) => x.userId === b.userId).id;
    await http
      .patch(api(`/properties/${pid}/members/${mb}`))
      .set(o.auth)
      .send({ role: 'OWNER' })
      .expect(200);
    const inv = await http
      .post(api(`/properties/${pid}/invitations`))
      .set(b.auth)
      .send({ phone: '010-8500-0052', role: 'MANAGER' })
      .expect(201);
    await http
      .patch(api(`/properties/${pid}/members/${mb}`))
      .set(o.auth)
      .send({ role: 'MANAGER' })
      .expect(200);
    const u = await signup('010-8500-0052', '늦은 수락');
    const r = await http.post(api('/invitations/accept')).set(u.auth).send({ token: inv.body.devToken }).expect(400);
    expect(r.body.errorCode).toBe('INVITATION_INVALID');
  });

  it('A10 · A14 · A15 · A21 — 중복 업장 400 · 매니저 셀프 연결 403 · 문자 한도 429 · 업장 이름 주소 · 사업자번호', async () => {
    const o = await signup('010-8500-0060', '검증 사장');
    const pa = await property(o.auth, '621456789', '검증 A');
    const mgr = await member(o.auth, pa, '010-8500-0061', '검증 매니저', 'MANAGER');

    const dup = await http
      .put(api(`/portfolio/people/${mgr.userId}`))
      .set(o.auth)
      .send({
        assignments: [
          { propertyId: pa, role: 'STAFF' },
          { propertyId: pa, role: null },
        ],
      })
      .expect(400);
    expect(dup.body.errorCode).toBe('DUPLICATE_PROPERTY');

    const self = await http
      .post(api(`/properties/${pa}/staff/employees`))
      .set(mgr.auth)
      .send({
        name: '나',
        phone: '010-8500-0061',
        jobRole: 'MANAGER',
        payType: 'HOURLY',
        payAmount: 50_000,
        hiredDate: today,
      })
      .expect(403);
    expect(self.body.errorCode).toBe('SELF_EDIT_FORBIDDEN');

    const link = await http
      .post(api('/properties'))
      .set(o.auth)
      .send({
        name: '무료쿠폰 bit.ly/abc 호텔',
        type: 'HOTEL',
        address: '대전',
        rooms: 3,
        bizNo: validBizNo('622456789'),
        ownerName: '사장',
      })
      .expect(400);
    expect(link.body).toMatchObject({
      errorCode: 'VALIDATION',
      message: '업장 이름에는 인터넷 주소를 넣을 수 없어요.',
    });

    // 같은 사장님은 같은 사업자번호로 업장을 더 낼 수 있고, 다른 사장님은 409
    await property(o.auth, '621456789', '검증 A 2호점');
    const other = await signup('010-8500-0062', '다른 사장');
    const taken = await http
      .post(api('/properties'))
      .set(other.auth)
      .send({
        name: '가로채기',
        type: 'HOTEL',
        address: '대전',
        rooms: 3,
        bizNo: validBizNo('621456789'),
        ownerName: '남',
      })
      .expect(409);
    expect(taken.body.errorCode).toBe('BIZ_NO_TAKEN');

    // 오늘 이미 30통을 보냈으면 초대 문자는 429
    await prisma.smsSendLog.createMany({
      data: Array.from({ length: 30 }, () => ({ userId: o.userId, kind: 'INVITE' })),
    });
    const capped = await http
      .post(api(`/properties/${pa}/invitations`))
      .set(o.auth)
      .send({ phone: '010-8500-0063', role: 'STAFF' })
      .expect(429);
    expect(capped.body).toMatchObject({
      errorCode: 'INVITE_SMS_DAILY_LIMIT',
      message: '오늘 보낼 수 있는 초대 문자를 다 썼어요.',
    });
    expect(sms.lastTo('01085000063')).toBeUndefined();
  });

  it('A17 검증 오류는 한국어 한 줄 — 영어 기본 문구 · enum 목록 · 필드명 · 깨진 JSON', async () => {
    const extra = await http
      .post(api('/auth/login'))
      .send({ phone: '010-8500-0001', password: 'woojoo1234', zzz: 1 })
      .expect(400);
    expect(extra.body.errorCode).toBe('VALIDATION');
    expect(extra.body.message).not.toMatch(/zzz|property|should/);
    const o = await signup('010-8500-0070', '오류 사장');
    const bad = await http
      .post(api('/properties'))
      .set(o.auth)
      .send({
        name: '호텔',
        type: 'NOPE',
        address: '대전',
        rooms: 3,
        bizNo: validBizNo('623456789'),
        ownerName: '사장',
      })
      .expect(400);
    expect(bad.body).toEqual({
      statusCode: 400,
      errorCode: 'VALIDATION',
      message: '종류가 올바르지 않아요. 다시 확인해 주세요.',
    });
    // 직접 쓴 한국어 메시지는 그대로
    const phone = await http.post(api('/auth/login')).send({ phone: 'x', password: 'woojoo1234' }).expect(400);
    expect(phone.body.message).toBe('휴대폰 번호 형식이 아니에요.');
    const json = await http
      .post(api('/auth/login'))
      .set('Content-Type', 'application/json')
      .send('{"phone":')
      .expect(400);
    expect(json.body).toMatchObject({
      errorCode: 'BAD_JSON',
      message: '보낸 내용을 읽지 못했어요. 다시 시도해 주세요.',
    });
    const uuid = await http.post(api('/notifications/not-a-uuid/read')).set(o.auth).expect(400);
    expect(uuid.body.errorCode).toBe('BAD_INPUT');
    expect(uuid.body.message).toMatch(/\p{Script=Hangul}/u);
  });

  it('A18 · A20 · A25 · A26 — 직원에게 사업자번호 숨김 · 정산 채널 수 · 지출 미래 날짜 · 체험 중 끄기', async () => {
    const o = await signup('010-8500-0080', '여러 사장');
    const pid = await property(o.auth, '624456789', '여러 호텔');
    const staff = await member(o.auth, pid, '010-8500-0081', '직원', 'STAFF');
    const asStaff = await http
      .get(api(`/properties/${pid}`))
      .set(staff.auth)
      .expect(200);
    expect(asStaff.body).not.toHaveProperty('bizNo');
    expect(asStaff.body).not.toHaveProperty('ownerName');
    expect(asStaff.body).not.toHaveProperty('managerId');
    expect(asStaff.body.name).toBe('여러 호텔');
    expect(
      (
        await http
          .get(api(`/properties/${pid}`))
          .set(o.auth)
          .expect(200)
      ).body.bizNo,
    ).toBeTruthy();

    await prisma.settlement.createMany({
      data: [
        { propertyId: pid, channel: 'YANOLJA', expectedDate: dateOnly(addDaysIso(today, 1)), amount: 100 },
        { propertyId: pid, channel: 'YANOLJA', expectedDate: dateOnly(addDaysIso(today, 3)), amount: 200 },
        { propertyId: pid, channel: 'YEOGI', expectedDate: dateOnly(addDaysIso(today, 2)), amount: 300 },
      ],
    });
    const dash = await http
      .get(api(`/properties/${pid}/dashboard`))
      .set(o.auth)
      .expect(200);
    expect(dash.body.settlementWeek).toMatchObject({ amount: 600, count: 2, items: 3 });

    const future = await http
      .post(api(`/properties/${pid}/expenses`))
      .set(o.auth)
      .send({ date: addDaysIso(today, 1), vendor: '세탁', category: 'LAUNDRY', amount: 1000 })
      .expect(400);
    expect(future.body.message).toBe('지출 날짜는 오늘까지만 넣을 수 있어요.');
    await http
      .post(api(`/properties/${pid}/expenses`))
      .set(o.auth)
      .send({ date: today, vendor: '세탁', category: 'LAUNDRY', amount: 1000 })
      .expect(201);

    const off = await http
      .put(api(`/properties/${pid}/subscriptions/LEDGER`))
      .set(o.auth)
      .send({ enabled: false })
      .expect(200);
    expect(off.body.inTrial).toBe(true);
    expect(off.body.subscribed).toEqual(['REVIEW']);
  });

  it('A19 통합 리뷰함 상한 — 미답변을 먼저 채우고 남는 자리에 최근 답글', async () => {
    const o = await signup('010-8500-0090', '리뷰 사장');
    const pid = await property(o.auth, '625456789', '리뷰 많은 호텔');
    const base = {
      propertyId: pid,
      channel: 'YANOLJA' as const,
      author: '손님',
      rating: 5,
      body: '좋아요',
      sentiment: 'POSITIVE' as const,
    };
    await prisma.review.createMany({
      data: Array.from({ length: 1001 }, (_, i) => ({
        ...base,
        externalId: `qa-posted-${i}`,
        postedAt: new Date(Date.now() - i * 1000),
        status: 'POSTED' as const,
      })),
    });
    const posted = await prisma.review.findMany({ where: { propertyId: pid }, select: { id: true } });
    await prisma.reply.createMany({
      data: posted.map((r) => ({ reviewId: r.id, text: '감사합니다', via: 'COPY' as const })),
    });
    // 미답변 2건은 한 달 전 — 날짜순이면 잘렸을 것
    await prisma.review.createMany({
      data: [0, 1].map((i) => ({
        ...base,
        externalId: `qa-open-${i}`,
        postedAt: new Date(Date.now() - 30 * 86_400_000),
        status: 'UNANSWERED' as const,
      })),
    });
    const inbox = await http.get(api('/portfolio/reviews')).set(o.auth).expect(200);
    expect(inbox.body.items).toHaveLength(1000);
    expect(inbox.body.truncated).toBe(true);
    expect(inbox.body.items.filter((r: { status: string }) => r.status === 'UNANSWERED')).toHaveLength(2);
  });

  it('A22 직원 명단 ↔ 앱 계정 — 가입하면 직원으로 연결 · 가입한 사람을 등록해도 연결 · 퇴사하면 직원 권한 빼기', async () => {
    const o = await signup('010-8500-0100', '연결 사장');
    const pid = await property(o.auth, '626456789', '연결 호텔');
    const e1 = await employee(o.auth, pid, { name: '먼저 등록', phone: '010-8500-0101' });
    const u1 = await signup('010-8500-0101', '먼저 등록');
    const me = await http.get(api('/auth/me')).set(u1.auth).expect(200);
    expect(me.body.properties).toEqual([expect.objectContaining({ id: pid, role: 'STAFF' })]);
    expect(
      (
        await http
          .get(api(`/properties/${pid}/staff/me`))
          .set(u1.auth)
          .expect(200)
      ).body.employee.id,
    ).toBe(e1);

    const u2 = await signup('010-8500-0102', '나중 등록');
    const e2 = await employee(o.auth, pid, { name: '나중 등록', phone: '010-8500-0102' });
    expect((await http.get(api('/auth/me')).set(u2.auth).expect(200)).body.properties).toEqual([
      expect.objectContaining({ id: pid, role: 'STAFF' }),
    ]);
    // 계약서 문자에 앱 로그인 안내
    await http
      .post(api(`/properties/${pid}/staff/employees/${e2}/contract`))
      .set(o.auth)
      .expect(200);
    expect(sms.lastTo('01085000102')).toContain('우주스테이 앱에서 출퇴근: ');
    expect(sms.lastTo('01085000102')).toContain('/app/login');

    await http
      .patch(api(`/properties/${pid}/staff/employees/${e1}`))
      .set(o.auth)
      .send({ resignedDate: addDaysIso(today, -1) })
      .expect(200);
    expect((await http.get(api('/auth/me')).set(u1.auth).expect(200)).body.properties).toEqual([]);
    // 다시 로그인해도 다시 들어오지 않는다
    await http.post(api('/auth/login')).send({ phone: '010-8500-0101', password: 'woojoo1234' }).expect(200);
    expect((await http.get(api('/auth/me')).set(u1.auth).expect(200)).body.properties).toEqual([]);
  });

  it('2차 급여는 사장님만 — 매니저는 시급·월급을 넣거나 바꿀 수 없다 (그 밖 정보는 고칠 수 있음)', async () => {
    const o = await signup('010-8500-0110', '급여 사장');
    const pid = await property(o.auth, '627456789', '급여 호텔');
    const mgr = await member(o.auth, pid, '010-8500-0111', '급여 매니저', 'MANAGER');
    const e = await employee(o.auth, pid, { name: '알바', phone: '010-8500-0112' });

    // 매니저가 급여를 넣어 등록 → 403, 급여 없이 등록 → 그해 최저시급 시급제
    const withPay = await http
      .post(api(`/properties/${pid}/staff/employees`))
      .set(mgr.auth)
      .send({
        name: '새 알바',
        phone: '010-8500-0113',
        jobRole: 'FRONT',
        payType: 'HOURLY',
        payAmount: 20_000,
        hiredDate: today,
      })
      .expect(403);
    expect(withPay.body.errorCode).toBe('PAY_OWNER_ONLY');
    const noPay = await http
      .post(api(`/properties/${pid}/staff/employees`))
      .set(mgr.auth)
      .send({ name: '새 알바', phone: '010-8500-0113', jobRole: 'FRONT', hiredDate: today })
      .expect(201);
    expect(noPay.body.payType).toBe('HOURLY');
    expect(noPay.body.payAmount).toBe(minimumWageFor(today));
    // 사장님은 급여 없이 등록할 수 없다
    const ownerNoPay = await http
      .post(api(`/properties/${pid}/staff/employees`))
      .set(o.auth)
      .send({ name: '빈 급여', phone: '010-8500-0114', jobRole: 'FRONT', hiredDate: today })
      .expect(400);
    expect(ownerNoPay.body.errorCode).toBe('VALIDATION');

    // 매니저 수정: 급여 바꾸기 403 (시급·급여 종류 모두) · 같은 값·다른 정보는 200
    for (const body of [{ payAmount: 12_000 }, { payType: 'MONTHLY', payAmount: 2_500_000 }]) {
      const r = await http
        .patch(api(`/properties/${pid}/staff/employees/${e}`))
        .set(mgr.auth)
        .send(body)
        .expect(403);
      expect(r.body.errorCode).toBe('PAY_OWNER_ONLY');
    }
    await http
      .patch(api(`/properties/${pid}/staff/employees/${e}`))
      .set(mgr.auth)
      .send({ jobRole: 'NIGHT', payAmount: 11_000 })
      .expect(200);
    // 사장님은 바꿀 수 있다
    await http
      .patch(api(`/properties/${pid}/staff/employees/${e}`))
      .set(o.auth)
      .send({ payAmount: 12_000 })
      .expect(200);
    const ov = await http
      .get(api(`/properties/${pid}/staff`))
      .set(o.auth)
      .expect(200);
    const row = ov.body.members.find((m: { id: string }) => m.id === e);
    expect(row).toMatchObject({ jobRole: 'NIGHT', payAmount: 12_000 });
    // 매니저가 받는 알바관리 데이터에는 급여가 없다
    const mv = await http
      .get(api(`/properties/${pid}/staff`))
      .set(mgr.auth)
      .expect(200);
    expect(mv.body.payroll).toEqual([]);
    expect(mv.body.members.every((m: { payAmount: number }) => m.payAmount === 0)).toBe(true);
  });
});
