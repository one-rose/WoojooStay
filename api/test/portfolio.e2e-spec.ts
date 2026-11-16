import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { isValidBizNo } from '../src/common/utils/biz-no.js';
import { addDaysIso, addMonths, dateOnly, kstDate } from '../src/common/utils/dates.js';
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

  it('통합 리뷰함 — 내 업장 미답변 전부 + 최근 7일 답글, 남의 업장·직원 업장은 빠진다', async () => {
    await review(managed, 2);
    await review(staffOnly, 1);
    await review(foreign, 1);
    const res = await http.get(api('/portfolio/reviews')).set(owner.auth).expect(200);
    const ids = res.body.properties.map((p: { id: string }) => p.id);
    expect(ids).toEqual(expect.arrayContaining([busy, quiet, managed]));
    expect(ids).not.toContain(staffOnly);
    expect(ids).not.toContain(foreign);
    type Row = { id: string; propertyId: string; status: string; rating: number };
    const rows: Row[] = res.body.items;
    expect(rows.every((r) => [busy, quiet, managed].includes(r.propertyId))).toBe(true);
    // 바쁜 호텔: 미답변 3건 · 답글 기록 없는 POSTED 1건은 빠진다
    expect(rows.filter((r) => r.propertyId === busy).map((r) => r.status)).toEqual([
      'UNANSWERED',
      'UNANSWERED',
      'UNANSWERED',
    ]);
    expect(res.body.channels).toEqual([{ channel: 'YANOLJA', name: expect.any(String), replyMode: 'COPY' }]);

    // 매니저인 업장 리뷰에 그 업장 주소로 답글 → 최근 답글로 남는다
    const target = rows.find((r) => r.propertyId === managed)!;
    await http
      .post(api(`/properties/${managed}/reviews/${target.id}/reply`))
      .set(owner.auth)
      .send({ text: '감사합니다.' })
      .expect(201);
    const after = await http.get(api('/portfolio/reviews')).set(owner.auth).expect(200);
    expect(after.body.items.find((r: Row) => r.id === target.id)).toMatchObject({
      status: 'POSTED',
      reply: { text: '감사합니다.' },
    });
    // 남의 업장 리뷰에는 답글을 못 단다 (남의 업장은 있는지도 알려 주지 않음)
    const theirs = await prisma.review.findFirstOrThrow({ where: { propertyId: foreign } });
    await http
      .post(api(`/properties/${foreign}/reviews/${theirs.id}/reply`))
      .set(owner.auth)
      .send({ text: '감사합니다.' })
      .expect(404);
  });

  it('통합 알림 — 업장을 빼면 내 업장 전부의 알림이 업장 이름과 함께, 모두 읽음도 전부', async () => {
    await prisma.notification.createMany({
      data: [
        {
          propertyId: busy,
          userId: owner.userId,
          kind: 'SYNC',
          text: '여기어때 연동이 끊겼어요.',
          link: '/app/settings/channels',
        },
        { propertyId: quiet, userId: owner.userId, kind: 'REVIEW', text: '새 리뷰 2건', link: '/app/reviews' },
        { propertyId: foreign, userId: other.userId, kind: 'REVIEW', text: '남의 알림' },
      ],
    });
    const all = await http.get(api('/notifications')).set(owner.auth).expect(200);
    type N = { text: string; propertyId: string; propertyName: string };
    const mine: N[] = all.body.items;
    expect(mine.map((n) => n.text)).toEqual(expect.arrayContaining(['여기어때 연동이 끊겼어요.', '새 리뷰 2건']));
    expect(mine.some((n) => n.text === '남의 알림')).toBe(false);
    expect(mine.find((n) => n.propertyId === busy)?.propertyName).toBe('바쁜 호텔');
    expect(all.body.unread).toBeGreaterThanOrEqual(2);

    const one = await http
      .get(api(`/notifications?propertyId=${quiet}`))
      .set(owner.auth)
      .expect(200);
    expect(one.body.items.every((n: N) => n.propertyId === quiet)).toBe(true);

    await http.post(api('/notifications/read-all')).set(owner.auth).expect(204);
    const after = await http.get(api('/notifications')).set(owner.auth).expect(200);
    expect(after.body.unread).toBe(0);
    // 남의 알림은 그대로
    const theirs = await http.get(api('/notifications')).set(other.auth).expect(200);
    expect(theirs.body.items.find((n: N) => n.text === '남의 알림')).toMatchObject({ readAt: null });
  });

  it('업장 비교 리포트 — 지난 달: 업장별 매출 · 예약 · 객실당 하루 매출 · 채널 · 전월 비교 · 6개월 추이', async () => {
    const thisMonth = today.slice(0, 7);
    const last = addMonths(thisMonth, -3); // 이번 달·지난달 픽스처와 겹치지 않게 석 달 전
    const before = addMonths(last, -1);
    await booking(quiet, `${last}-05`, 600_000);
    await booking(quiet, `${last}-20`, 300_000);
    await booking(quiet, `${last}-21`, 999_000, 'CANCELLED');
    await booking(quiet, `${before}-11`, 450_000);
    await prisma.booking.create({
      data: {
        propertyId: quiet,
        channel: 'AGODA',
        reservationNo: 'pf-report-agoda',
        guestName: '박*',
        roomType: '트윈',
        checkinDate: dateOnly(`${last}-07`),
        checkoutDate: dateOnly(`${last}-08`),
        saleAmount: 300_000,
        commission: 45_000,
        bookedAt: new Date(),
      },
    });
    const res = await http
      .get(api(`/portfolio/report?month=${last}`))
      .set(owner.auth)
      .expect(200);
    expect(res.body).toMatchObject({ month: last, partial: false });
    expect(res.body.months).toHaveLength(6);
    expect(res.body.months[5]).toBe(last);
    const ids = res.body.properties.map((p: { id: string }) => p.id);
    expect(ids).not.toContain(staffOnly);
    expect(ids).not.toContain(foreign);
    const q = res.body.properties.find((p: { id: string }) => p.id === quiet);
    const days = new Date(Date.UTC(Number(last.slice(0, 4)), Number(last.slice(5, 7)), 0)).getUTCDate();
    expect(q).toMatchObject({
      sales: 1_200_000,
      bookings: 3,
      commission: 45_000,
      prevSales: 450_000,
      perRoomDay: Math.round(1_200_000 / (6 * days)),
    });
    expect(q.channels.map((c: { channel: string }) => c.channel)).toEqual(['YANOLJA', 'AGODA']);
    expect(q.trend[5]).toBe(1_200_000);
    expect(q.trend[4]).toBe(450_000);

    await http.get(api('/portfolio/report?month=2026-13')).set(owner.auth).expect(400);
  });

  it('직원·권한 — 한 사람을 여러 업장에 함께 초대하고, 링크 하나로 모두 수락', async () => {
    // 사장님인 업장(busy · quiet)만 — 매니저인 업장(managed)에는 초대할 수 없다
    await http
      .post(api('/portfolio/invitations'))
      .set(owner.auth)
      .send({ phone: '010-8410-0101', role: 'MANAGER', propertyIds: [busy, managed] })
      .expect(403);
    const inv = await http
      .post(api('/portfolio/invitations'))
      .set(owner.auth)
      .send({ phone: '010-8410-0101', role: 'MANAGER', propertyIds: [busy, quiet] })
      .expect(201);
    expect(inv.body.invited).toEqual(['바쁜 호텔', '조용한 펜션']);
    const preview = await http.get(api(`/invitations/${inv.body.devToken}`)).expect(200);
    expect(preview.body).toMatchObject({ propertyName: '바쁜 호텔', status: 'VALID', alsoProperties: ['조용한 펜션'] });

    const listed = await http.get(api('/portfolio/people')).set(owner.auth).expect(200);
    expect(listed.body.properties.map((p: { id: string }) => p.id)).toEqual([busy, quiet]);
    expect(listed.body.invitations).toEqual([
      expect.objectContaining({ role: 'MANAGER', propertyIds: expect.arrayContaining([busy, quiet]) }),
    ]);

    const mgr = await signup('010-8410-0101', '새 매니저');
    const acc = await http
      .post(api('/invitations/accept'))
      .set(mgr.auth)
      .send({ token: inv.body.devToken })
      .expect(200);
    expect(acc.body.joined).toBe(2);
    const pf = await http.get(api('/portfolio')).set(mgr.auth).expect(200);
    expect(pf.body.properties.map((p: { id: string }) => p.id).sort()).toEqual([busy, quiet].sort());
  });

  it('직원·권한 — 업장별 권한을 한 번에 바꾸고 빼기, 남의 업장 · 다른 사장님 권한은 못 바꾼다', async () => {
    const mgr = await http.get(api('/portfolio/people')).set(owner.auth).expect(200);
    type Person = { userId: string; name: string; roles: Record<string, string> };
    const person: Person = mgr.body.people.find((p: Person) => p.name === '새 매니저');
    expect(person.roles).toEqual({ [busy]: 'MANAGER', [quiet]: 'MANAGER' });

    const res = await http
      .put(api(`/portfolio/people/${person.userId}`))
      .set(owner.auth)
      .send({
        assignments: [
          { propertyId: busy, role: 'STAFF' },
          { propertyId: quiet, role: null },
        ],
      })
      .expect(200);
    expect(res.body.people.find((p: Person) => p.userId === person.userId).roles).toEqual({ [busy]: 'STAFF' });

    // 내가 매니저일 뿐인 업장 · 남의 업장
    await http
      .put(api(`/portfolio/people/${person.userId}`))
      .set(owner.auth)
      .send({ assignments: [{ propertyId: managed, role: 'MANAGER' }] })
      .expect(403);
    // 내 업장과 관계없는 사람
    await http
      .put(api(`/portfolio/people/${other.userId}`))
      .set(owner.auth)
      .send({ assignments: [{ propertyId: busy, role: 'MANAGER' }] })
      .expect(404);
    // 잘못된 권한 값
    await http
      .put(api(`/portfolio/people/${person.userId}`))
      .set(owner.auth)
      .send({ assignments: [{ propertyId: busy, role: 'OWNER' }] })
      .expect(400);
  });

  it('업장이 없으면 빈 목록', async () => {
    const lone = await signup('010-8410-0003', '새 사장');
    const res = await http.get(api('/portfolio')).set(lone.auth).expect(200);
    expect(res.body.properties).toEqual([]);
    expect(res.body.totals).toMatchObject({ properties: 0, today: { sales: 0 } });
  });
});
