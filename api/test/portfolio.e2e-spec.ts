import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { isValidBizNo } from '../src/common/utils/biz-no.js';
import { addDaysIso, dateOnly, kstDate } from '../src/common/utils/dates.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

function validBizNo(prefix: string): string {
  for (let d = 0; d <= 9; d++) if (isValidBizNo(prefix + d)) return prefix + d;
  throw new Error('no');
}

/** 여러 업장 통합 현황 (F8) — GET /portfolio */
describe('여러 업장 통합 현황 (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
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
      userId: res.body.user.id as string,
    };
  }

  async function property(owner: Auth, prefix: string, name: string, rooms = 10) {
    const p = await http
      .post(api('/properties'))
      .set(owner)
      .send({ name, type: 'HOTEL', address: '대전 서구', rooms, bizNo: validBizNo(prefix), ownerName: '사장' })
      .expect(201);
    return p.body.id as string;
  }

  const today = kstDate();
  let seq = 0;
  async function booking(
    propertyId: string,
    date: string,
    amount: number,
    status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED',
  ) {
    seq += 1;
    await prisma.booking.create({
      data: {
        propertyId,
        channel: 'YANOLJA',
        reservationNo: `pf-${seq}`,
        guestName: '김*',
        roomType: '더블',
        checkinDate: dateOnly(date),
        checkoutDate: dateOnly(addDaysIso(date, 1)),
        saleAmount: amount,
        status,
        bookedAt: new Date(),
      },
    });
  }
  async function review(propertyId: string, rating: number, status: 'UNANSWERED' | 'POSTED' = 'UNANSWERED') {
    seq += 1;
    await prisma.review.create({
      data: {
        propertyId,
        channel: 'YANOLJA',
        externalId: `pf-r-${seq}`,
        author: '손님',
        rating,
        body: '후기',
        postedAt: new Date(),
        status,
        sentiment: rating >= 4 ? 'POSITIVE' : 'IMPROVE',
      },
    });
  }
  async function channel(
    propertyId: string,
    ch: 'YANOLJA' | 'YEOGI' | 'AGODA',
    status: 'CONNECTED' | 'AUTH_EXPIRED' | 'ERROR',
  ) {
    await prisma.channelConnection.create({
      data: { propertyId, channel: ch, status, credentials: 'x', consentAt: new Date() },
    });
  }

  let owner: Awaited<ReturnType<typeof signup>>;
  let other: Awaited<ReturnType<typeof signup>>;
  /** 내가 사장님 — 문제 많은 업장 / 조용한 업장 */
  let busy: string;
  let quiet: string;
  /** 남의 업장 — 나는 직원(STAFF) / 매니저(MANAGER) / 관계없음 */
  let staffOnly: string;
  let managed: string;
  let foreign: string;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(m.createNestApplication());
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);

    owner = await signup('010-8410-0001', '한소영');
    other = await signup('010-8410-0002', '다른 사장');
    busy = await property(owner.auth, '430456789', '바쁜 호텔', 20);
    quiet = await property(owner.auth, '431456789', '조용한 펜션', 6);
    staffOnly = await property(other.auth, '432456789', '남의 호텔 (직원)');
    managed = await property(other.auth, '433456789', '남의 호텔 (매니저)');
    foreign = await property(other.auth, '434456789', '남의 호텔 (관계없음)');
    await prisma.membership.createMany({
      data: [
        { userId: owner.userId, propertyId: staffOnly, role: 'STAFF' },
        { userId: owner.userId, propertyId: managed, role: 'MANAGER' },
      ],
    });

    // 바쁜 호텔: 오늘 300만(취소 1건 제외) · 어제 200만 · 미답변 3건(저평점 2) · 정산 7일 안 150만(8일 뒤·완료분 제외)
    await booking(busy, today, 2_000_000);
    await booking(busy, today, 1_000_000);
    await booking(busy, today, 9_999_000, 'CANCELLED');
    await booking(busy, addDaysIso(today, -1), 2_000_000);
    await review(busy, 1);
    await review(busy, 3);
    await review(busy, 5);
    await review(busy, 2, 'POSTED');
    await prisma.settlement.createMany({
      data: [
        { propertyId: busy, channel: 'YANOLJA', expectedDate: dateOnly(addDaysIso(today, 2)), amount: 1_000_000 },
        { propertyId: busy, channel: 'YEOGI', expectedDate: dateOnly(addDaysIso(today, 7)), amount: 500_000 },
        { propertyId: busy, channel: 'YEOGI', expectedDate: dateOnly(addDaysIso(today, 8)), amount: 700_000 },
        {
          propertyId: busy,
          channel: 'AGODA',
          expectedDate: dateOnly(addDaysIso(today, 1)),
          amount: 900_000,
          settled: true,
        },
      ],
    });
    // 채널: 정상 1 · 재로그인 필요 1 · 오류 1 — 결제 실패 · 청소 지연 1실 · 퇴근 누락 1건 · 근무 중 1명
    await channel(busy, 'YANOLJA', 'CONNECTED');
    await channel(busy, 'YEOGI', 'AUTH_EXPIRED');
    await channel(busy, 'AGODA', 'ERROR');
    await prisma.subscription.updateMany({ where: { propertyId: busy }, data: { status: 'PAST_DUE' } });
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
    await prisma.room.createMany({
      data: [
        { propertyId: busy, number: '201', status: 'DIRTY', statusChangedAt: hoursAgo(3) },
        { propertyId: busy, number: '202', status: 'DIRTY', statusChangedAt: hoursAgo(1) },
        { propertyId: busy, number: '203', status: 'OCCUPIED' },
        { propertyId: busy, number: '204', status: 'READY' },
      ],
    });
    const e = await prisma.employee.create({
      data: {
        propertyId: busy,
        name: '오세린',
        phone: '01084100101',
        jobRole: 'FRONT',
        payType: 'HOURLY',
        payAmount: 10_500,
        hiredDate: dateOnly(addDaysIso(today, -60)),
      },
    });
    await prisma.attendance.createMany({
      data: [
        { employeeId: e.id, workDate: dateOnly(addDaysIso(today, -3)), clockInAt: hoursAgo(72) },
        { employeeId: e.id, workDate: dateOnly(today), clockInAt: hoursAgo(2) },
      ],
    });

    // 매니저로 있는 남의 업장 — 결제 실패여도 결제 상태는 보이지 않는다
    await booking(managed, today, 500_000);
    await channel(managed, 'YANOLJA', 'CONNECTED');
    await prisma.subscription.updateMany({ where: { propertyId: managed }, data: { status: 'PAST_DUE' } });
    // 직원으로만 있는 업장 · 관계없는 업장 — 매출이 있어도 합계에 들어가지 않는다
    await booking(staffOnly, today, 7_000_000);
    await booking(foreign, today, 8_000_000);
  });

  afterAll(async () => {
    await app.close();
  });

  it('로그인해야 볼 수 있다', async () => {
    await http.get(api('/portfolio')).expect(401);
  });

  it('내가 사장님·매니저인 업장만 — 직원으로만 있는 업장 · 남의 업장은 빠진다', async () => {
    const res = await http.get(api('/portfolio')).set(owner.auth).expect(200);
    expect(res.body.date).toBe(today);
    const ids = res.body.properties.map((p: { id: string }) => p.id);
    expect(ids).toEqual([busy, quiet, managed]);
    expect(ids).not.toContain(staffOnly);
    expect(ids).not.toContain(foreign);
    const roles = Object.fromEntries(res.body.properties.map((p: { id: string; role: string }) => [p.id, p.role]));
    expect(roles).toEqual({ [busy]: 'OWNER', [quiet]: 'OWNER', [managed]: 'MANAGER' });

    // 다른 사장님은 자기 업장 셋만 (내가 직원·매니저로 붙어 있어도 상관없음)
    const theirs = await http.get(api('/portfolio')).set(other.auth).expect(200);
    expect(theirs.body.properties.map((p: { id: string }) => p.id).sort()).toEqual(
      [staffOnly, managed, foreign].sort(),
    );
  });

  it('업장별 숫자와 합계', async () => {
    const res = await http.get(api('/portfolio')).set(owner.auth).expect(200);
    const b = res.body.properties.find((p: { id: string }) => p.id === busy);
    expect(b).toMatchObject({
      name: '바쁜 호텔',
      type: 'HOTEL',
      rooms: 20,
      today: { sales: 3_000_000, bookings: 2, yesterdaySales: 2_000_000 },
      reviews: { unanswered: 3, lowRated: 2 },
      settle7: 1_500_000,
      roomStatus: { ready: 1, dirty: 2, cleaning: 0, inspect: 0, occupied: 1, outOfOrder: 0, staleDirty: 1 },
      staff: { onDuty: 1, missingClockOut: 1 },
      channels: { connected: 1, error: 1, authExpired: 1 },
      billing: { status: 'PAST_DUE' },
    });
    expect(b.month.sales).toBeGreaterThanOrEqual(3_000_000);

    const mgr = res.body.properties.find((p: { id: string }) => p.id === managed);
    expect(mgr.billing.status).toBeNull();
    expect(mgr.alerts.map((a: { kind: string }) => a.kind)).not.toContain('PAYMENT_FAILED');

    const q = res.body.properties.find((p: { id: string }) => p.id === quiet);
    expect(q).toMatchObject({ today: { sales: 0, bookings: 0 }, reviews: { unanswered: 0 }, settle7: 0 });

    expect(res.body.totals).toMatchObject({
      properties: 3,
      today: { sales: 3_500_000, bookings: 3, yesterdaySales: 2_000_000 },
      reviews: { unanswered: 3, lowRated: 2 },
      settle7: 1_500_000,
    });
    const monthSum = res.body.properties.reduce((s: number, p: { month: { sales: number } }) => s + p.month.sales, 0);
    expect(res.body.totals.month.sales).toBe(monthSum);
    // 확인할 일이 있는 업장: 바쁜 호텔 · 조용한 펜션(채널 없음)
    expect(res.body.totals.needsAttention).toBe(2);
  });

  it('확인할 일은 급한 순 — 채널 끊김 > 결제 실패 > 저평점 > 청소 지연 > 퇴근 누락 > 채널 없음', async () => {
    const res = await http.get(api('/portfolio')).set(owner.auth).expect(200);
    const b = res.body.properties.find((p: { id: string }) => p.id === busy);
    expect(b.alerts.map((a: { kind: string }) => a.kind)).toEqual([
      'CHANNEL_AUTH',
      'CHANNEL_ERROR',
      'PAYMENT_FAILED',
      'LOW_RATED',
      'STALE_DIRTY',
      'MISSING_CLOCK_OUT',
    ]);
    expect(b.alerts[0]).toEqual({
      kind: 'CHANNEL_AUTH',
      message: expect.stringContaining('여기어때'),
      link: '/app/settings/channels',
    });
    expect(b.alerts[1].message).toContain('아고다');
    expect(b.alerts.find((a: { kind: string }) => a.kind === 'LOW_RATED').link).toBe('/app/reviews');
    expect(b.alerts.find((a: { kind: string }) => a.kind === 'STALE_DIRTY').link).toBe('/app/ops');

    const q = res.body.properties.find((p: { id: string }) => p.id === quiet);
    expect(q.alerts).toEqual([{ kind: 'NO_CHANNEL', message: expect.any(String), link: '/app/settings/channels' }]);
  });

  it('업장이 없으면 빈 목록', async () => {
    const lone = await signup('010-8410-0003', '새 사장');
    const res = await http.get(api('/portfolio')).set(lone.auth).expect(200);
    expect(res.body.properties).toEqual([]);
    expect(res.body.totals).toMatchObject({ properties: 0, today: { sales: 0 } });
  });
});
