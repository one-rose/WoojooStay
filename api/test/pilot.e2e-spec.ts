import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createAdminUser } from '../src/admin/admin-auth.service.js';
import { AppModule } from '../src/app.module.js';
import { BillingService } from '../src/billing/billing.service.js';
import { isValidBizNo } from '../src/common/utils/biz-no.js';
import { addDaysIso, dateOnly, kstDate } from '../src/common/utils/dates.js';
import { DailySummaryService } from '../src/portfolio/daily-summary.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ReviewIngestService } from '../src/reviews/review-ingest.service.js';
import { setupApp } from '../src/setup-app.js';

/**
 * 2차 PO — 실증 측정 · 운영 도구 확인.
 * 휴대폰 번호는 010-8600-xxxx 만, 사업자번호 앞자리는 6xx 만 쓴다.
 */
function validBizNo(prefix: string): string {
  for (let d = 0; d <= 9; d++) if (isValidBizNo(prefix + d)) return prefix + d;
  throw new Error('no');
}

describe('실증 측정 · 운영 도구 (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const api = (p: string) => `/api/v1${p}`;
  type Auth = { Authorization: string };
  type User = { auth: Auth; userId: string; refreshToken: string };

  const today = kstDate();
  const kst = (d: string, t: string) => new Date(`${d}T${t}:00+09:00`);
  let superAuth: Auth;
  let operatorAuth: Auth;

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
      refreshToken: res.body.refreshToken as string,
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

  async function adminLogin(email: string, role: 'SUPER' | 'OPERATOR'): Promise<Auth> {
    await createAdminUser(prisma, {
      email,
      name: role === 'SUPER' ? '실증 관리자' : '실증 운영자',
      password: 'Pilot1234!x',
      role,
    });
    const r = await http.post(api('/admin/auth/login')).send({ email, password: 'Pilot1234!x' }).expect(200);
    return { Authorization: `Bearer ${r.body.accessToken}` };
  }

  async function setPilot(pid: string, group: string | null, startedAt?: string) {
    return http
      .patch(api(`/admin/properties/${pid}/pilot`))
      .set(superAuth)
      .send({ group, startedAt })
      .expect(200);
  }

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(m.createNestApplication());
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    superAuth = await adminLogin('pilot-super@woojoo.kr', 'SUPER');
    operatorAuth = await adminLogin('pilot-op@woojoo.kr', 'OPERATOR');
  });

  afterAll(async () => {
    await app.close();
  });

  it('PO-01 로그인·가입은 lastLoginAt 을 늘 기록, 토큰 갱신은 오늘 처음일 때만 — 운영자 목록에 최근 접속', async () => {
    const u = await signup('010-8600-0001', '접속 사장');
    const pid = await property(u.auth, '601100110', '접속 호텔');
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.userId } });
    expect(after.lastLoginAt).not.toBeNull();

    // 어제 접속한 것으로 → 갱신하면 오늘로
    const yesterday = new Date(Date.now() - 30 * 3_600_000);
    await prisma.user.update({ where: { id: u.userId }, data: { lastLoginAt: yesterday } });
    const r1 = await http.post(api('/auth/refresh')).send({ refreshToken: u.refreshToken }).expect(200);
    const t1 = (await prisma.user.findUniqueOrThrow({ where: { id: u.userId } })).lastLoginAt!;
    expect(t1.getTime()).toBeGreaterThan(yesterday.getTime());

    // 오늘 이미 기록됐으면 갱신해도 그대로 (쓰기 줄이기)
    const earlier = new Date(Math.max(new Date(`${today}T00:00:01+09:00`).getTime(), Date.now() - 60_000));
    await prisma.user.update({ where: { id: u.userId }, data: { lastLoginAt: earlier } });
    await http.post(api('/auth/refresh')).send({ refreshToken: r1.body.refreshToken }).expect(200);
    const t2 = (await prisma.user.findUniqueOrThrow({ where: { id: u.userId } })).lastLoginAt!;
    expect(t2.getTime()).toBe(earlier.getTime());

    // 로그인은 매번
    await http.post(api('/auth/login')).send({ phone: '01086000001', password: 'woojoo1234' }).expect(200);
    const t3 = (await prisma.user.findUniqueOrThrow({ where: { id: u.userId } })).lastLoginAt!;
    expect(t3.getTime()).toBeGreaterThan(earlier.getTime());

    const list = await http
      .get(api(`/admin/properties?ownerId=${u.userId}`))
      .set(superAuth)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id: pid, owner: { id: u.userId, name: '접속 사장' } });
    expect(new Date(list.body[0].lastLogin.owner).getTime()).toBe(t3.getTime());
    expect(list.body[0].activation).toMatchObject({ stage: 'PROPERTY', blocked: 'CHANNEL' });
    const detail = await http
      .get(api(`/admin/properties/${pid}`))
      .set(superAuth)
      .expect(200);
    expect(new Date(detail.body.members[0].lastLoginAt).getTime()).toBe(t3.getTime());
  });

  it('PO-02 채널에 이미 있던 답글은 EXTERNAL(채널 시각, 없으면 null) — 업장 비교 답글률에서 빠진다', async () => {
    const u = await signup('010-8600-0002', '외부답글 사장');
    const pid = await property(u.auth, '602200220', '외부답글 호텔');
    const ingest = app.get(ReviewIngestService);
    const replyAt = new Date(Date.now() - 2 * 3_600_000);
    const now = new Date(Date.now() - 3 * 3_600_000);
    const base = { author: '손님', rating: 5, body: '좋았어요', photos: [], postedAt: now };
    await ingest.ingest(pid, 'YANOLJA', [
      { ...base, externalId: 'ext-1', existingReply: '감사합니다', existingReplyAt: replyAt },
      { ...base, externalId: 'ext-2', existingReply: '또 오세요' },
      { ...base, externalId: 'ext-3' },
    ]);
    const rows = await prisma.review.findMany({
      where: { propertyId: pid },
      include: { reply: true, draft: true },
      orderBy: { externalId: 'asc' },
    });
    expect(rows.map((r) => [r.status, r.reply?.via ?? null, !!r.draft])).toEqual([
      ['POSTED', 'EXTERNAL', false],
      ['POSTED', 'EXTERNAL', false],
      ['UNANSWERED', null, true],
    ]);
    expect(rows[0].reply!.postedAt!.getTime()).toBe(replyAt.getTime());
    expect(rows[1].reply!.postedAt).toBeNull();

    // 화면 응답에서도 그대로
    const one = await http
      .get(api(`/properties/${pid}/reviews/${rows[1].id}`))
      .set(u.auth)
      .expect(200);
    expect(one.body.reply).toMatchObject({ via: 'EXTERNAL', postedAt: null });

    // 우리 답글 1건 → 답글률 = 1 / (3 − 2)
    await http
      .post(api(`/properties/${pid}/reviews/${rows[2].id}/reply`))
      .set(u.auth)
      .send({ text: rows[2].draft!.text })
      .expect(201);
    const rep = await http.get(api('/portfolio/report')).set(u.auth).expect(200);
    expect(rep.body.properties[0].reviews).toMatchObject({ count: 3, answered: 1, replyBase: 1 });
  });

  it('PO-04 답글 게시·다시 쓰기·채널 연결 사용 기록 + 초안 수정 여부 / PO-05 평점은 하루 한 줄', async () => {
    const u = await signup('010-8600-0003', '기록 사장');
    const pid = await property(u.auth, '603300330', '기록 호텔');
    await http
      .post(api(`/properties/${pid}/channels/YANOLJA/connect`))
      .set(u.auth)
      .send({ loginId: 'rec', password: 'sample', consent: true })
      .expect(200);
    // 평점 — 연결(첫 수집) 때 한 줄, 같은 날 다시 수집해도 한 줄
    let snaps = await prisma.ratingSnapshot.findMany({ where: { propertyId: pid } });
    expect(snaps).toHaveLength(1);
    expect(snaps[0]).toMatchObject({ channel: 'YANOLJA', date: dateOnly(today) });
    expect(Number(snaps[0].rating)).toBeGreaterThan(3.9);
    await prisma.ratingSnapshot.update({ where: { id: snaps[0].id }, data: { rating: 1, reviewCount: 1 } });
    await http
      .post(api(`/properties/${pid}/channels/YANOLJA/sync`))
      .set(u.auth)
      .expect(200);
    snaps = await prisma.ratingSnapshot.findMany({ where: { propertyId: pid } });
    expect(snaps).toHaveLength(1);
    expect(Number(snaps[0].rating)).toBeGreaterThan(3.9);
    expect(snaps[0].reviewCount).toBeGreaterThan(1);

    const events = (kind: string) =>
      prisma.usageEvent.findMany({ where: { propertyId: pid, kind }, orderBy: { createdAt: 'asc' } });
    expect(await events('CHANNEL_CONNECT')).toMatchObject([{ userId: u.userId, meta: { channel: 'YANOLJA' } }]);
    const drafts = await events('DRAFT_CREATE');
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.every((e) => e.userId === null)).toBe(true);

    const list = await http
      .get(api(`/properties/${pid}/reviews?tab=unanswered`))
      .set(u.auth)
      .expect(200);
    const [a, b] = list.body.items as { id: string; draft: { text: string } }[];
    // 초안 그대로 (공백만 다름) → edited false
    await http
      .post(api(`/properties/${pid}/reviews/${a.id}/reply`))
      .set(u.auth)
      .send({ text: `  ${a.draft.text.replace(/ /g, '  ')} ` })
      .expect(201);
    // 다시 쓰기 → 고쳐서 게시 → edited true
    await http
      .post(api(`/properties/${pid}/reviews/${b.id}/draft`))
      .set(u.auth)
      .expect(200);
    await http
      .post(api(`/properties/${pid}/reviews/${b.id}/reply`))
      .set(u.auth)
      .send({ text: '직접 고친 답글이에요.' })
      .expect(201);
    const posts = await events('REPLY_POST');
    expect(
      posts.map((e) => [
        e.userId,
        (e.meta as { reviewId: string; edited: boolean }).reviewId,
        (e.meta as { edited: boolean }).edited,
      ]),
    ).toEqual([
      [u.userId, a.id, false],
      [u.userId, b.id, true],
    ]);
    expect(await events('DRAFT_REGENERATE')).toMatchObject([
      { userId: u.userId, meta: { reviewId: b.id, revision: 1 } },
    ]);
    const replies = await prisma.reply.findMany({ where: { reviewId: { in: [a.id, b.id] } } });
    expect(Object.fromEntries(replies.map((r) => [r.reviewId, r.draftEdited]))).toEqual({
      [a.id]: false,
      [b.id]: true,
    });

    // 장부 조회는 하루 한 번만
    await http
      .get(api(`/properties/${pid}/ledger`))
      .set(u.auth)
      .expect(200);
    await http
      .get(api(`/properties/${pid}/ledger`))
      .set(u.auth)
      .expect(200);
    expect(await events('LEDGER_VIEW')).toHaveLength(1);
    // 앱 열기(/auth/me) 도 하루 한 번, 업장 없이 사용자 단위
    await http.get(api('/auth/me')).set(u.auth).expect(200);
    await http.get(api('/auth/me')).set(u.auth).expect(200);
    expect(await prisma.usageEvent.count({ where: { userId: u.userId, kind: 'APP_OPEN', propertyId: null } })).toBe(1);

    // 운영자 상세 — 이번 달 AI 사용량
    const d = await http
      .get(api(`/admin/properties/${pid}`))
      .set(superAuth)
      .expect(200);
    expect(d.body.aiUsage.at(-1)).toMatchObject({ month: today.slice(0, 7), regenerations: 1, posts: 2 });
    expect(d.body.aiUsage.at(-1).drafts).toBe(drafts.length);
    expect(d.body.activation).toMatchObject({ stage: 'FIRST_REPLY', blocked: null });
  });

  it('PO-03 · PO-06~08 실증 지정 + KPI 숫자 (작은 예시) + 설문 값', async () => {
    const u = await signup('010-8600-0004', 'KPI 사장');
    const pid = await property(u.auth, '604400440', 'KPI 호텔');
    const start = addDaysIso(today, -10);
    const group = '테스트 실증 A';
    const set = await setPilot(pid, group, start);
    expect(set.body.pilot).toEqual({ group, startedAt: start, endsAt: addDaysIso(start, 55), active: true });

    // me — 실증 업장이면 요금·재고 숨김
    const me = await http.get(api('/auth/me')).set(u.auth).expect(200);
    expect(me.body.trialDays).toBe(30);
    expect(me.body.properties[0]).toMatchObject({ pilot: { group, active: true }, features: { rates: false } });

    const day = (n: number) => addDaysIso(start, n);
    let seq = 0;
    async function review(
      postedAt: Date,
      reply?: { via: 'COPY' | 'API' | 'EXTERNAL'; hours?: number; edited?: boolean },
    ) {
      seq += 1;
      return prisma.review.create({
        data: {
          propertyId: pid,
          channel: 'YANOLJA',
          externalId: `kpi-${seq}`,
          author: '손님',
          rating: 4,
          body: '좋아요',
          photos: [],
          postedAt,
          sentiment: 'POSITIVE',
          status: reply ? 'POSTED' : 'UNANSWERED',
          ...(reply
            ? {
                reply: {
                  create: {
                    text: '감사합니다',
                    via: reply.via,
                    postedAt: reply.hours ? new Date(postedAt.getTime() + reply.hours * 3_600_000) : null,
                    draftEdited: reply.via === 'EXTERNAL' ? null : (reply.edited ?? false),
                  },
                },
              }
            : {}),
        },
      });
    }
    // 1주 차: 우리 답글 2건(4시간·8시간, 초안 그대로 1건) · 미답변 1 · 채널에 이미 있던 답글 1 (빠짐)
    await review(kst(day(1), '10:00'), { via: 'COPY', hours: 4, edited: false });
    await review(kst(day(2), '10:00'), { via: 'API', hours: 8, edited: true });
    await review(kst(day(3), '10:00'));
    await review(kst(day(4), '10:00'), { via: 'EXTERNAL', hours: 30 });
    // 기준선: 미답변 1 · EXTERNAL 1 (빠짐)
    await review(kst(day(-5), '10:00'), { via: 'EXTERNAL' });
    await review(kst(day(-6), '10:00'));

    // 사용 기록: 사장님 앱 열기 2일(같은 날 두 번) · 장부 1일 · 남의 기록 · 시스템 초안
    const stranger = await signup('010-8600-0005', '남');
    await prisma.usageEvent.createMany({
      data: [
        { kind: 'APP_OPEN', userId: u.userId, createdAt: kst(day(1), '09:00') },
        { kind: 'APP_OPEN', userId: u.userId, createdAt: kst(day(2), '09:00') },
        { kind: 'OVERVIEW_VIEW', userId: u.userId, createdAt: kst(day(2), '23:30') },
        { kind: 'LEDGER_VIEW', userId: u.userId, propertyId: pid, createdAt: kst(day(2), '21:00') },
        { kind: 'APP_OPEN', userId: stranger.userId, createdAt: kst(day(3), '09:00') },
        { kind: 'DRAFT_CREATE', propertyId: pid, createdAt: kst(day(5), '09:00') },
      ],
    });
    // 지출 3건 중 영수증·카드 2건
    await prisma.expense.createMany({
      data: (['RECEIPT', 'MANUAL', 'CARD'] as const).map((source, i) => ({
        propertyId: pid,
        expenseDate: dateOnly(day(1 + i)),
        vendor: '가게',
        category: 'AMENITY' as const,
        amount: 10_000,
        source,
      })),
    });
    // 출근 2건 중 앱 기록 1건 (1건은 사장님이 고침)
    const emp = await http
      .post(api(`/properties/${pid}/staff/employees`))
      .set(u.auth)
      .send({
        name: '알바',
        phone: '010-8600-0099',
        jobRole: 'FRONT',
        payType: 'HOURLY',
        payAmount: 11_000,
        hiredDate: day(-30),
      })
      .expect(201);
    await prisma.attendance.createMany({
      data: [
        { employeeId: emp.body.id, workDate: dateOnly(day(1)), clockInAt: kst(day(1), '09:00'), method: 'GPS' },
        {
          employeeId: emp.body.id,
          workDate: dateOnly(day(2)),
          clockInAt: kst(day(2), '09:00'),
          method: 'MANUAL',
          editedAt: new Date(),
        },
      ],
    });
    // 평점: 기준선 마지막 4.2 → 1주 차 마지막 4.4
    await prisma.ratingSnapshot.createMany({
      data: [
        { propertyId: pid, channel: 'YANOLJA', date: dateOnly(day(-1)), rating: 4.2, reviewCount: 100 },
        { propertyId: pid, channel: 'YANOLJA', date: dateOnly(day(1)), rating: 4.3, reviewCount: 101 },
        { propertyId: pid, channel: 'YANOLJA', date: dateOnly(day(6)), rating: 4.4, reviewCount: 103 },
      ],
    });

    const k = await http
      .get(api(`/admin/pilot?group=${encodeURIComponent(group)}`))
      .set(superAuth)
      .expect(200);
    expect(k.body.groups).toContainEqual({ name: group, properties: 1 });
    expect(k.body.definitions.responseTime).toContain('중앙값');
    const p = k.body.properties[0];
    expect(p).toMatchObject({ id: pid, pilot: { group, startedAt: start, week: 2 } });
    expect(p.weeks).toHaveLength(9);
    const [w0, w1, w2, w3] = p.weeks;
    expect(w0).toMatchObject({
      week: 0,
      from: addDaysIso(start, -90),
      to: day(-1),
      days: 90,
      reviews: 1,
      answered: 0,
      responseRate: 0,
    });
    expect(w0.rating).toBe(4.2);
    expect(w1).toMatchObject({
      week: 1,
      from: start,
      to: day(6),
      days: 7,
      partial: false,
      reviews: 3,
      answered: 2,
      responseRate: 0.667,
      medianResponseHours: 6,
      repliesWithDraft: 2,
      draftAsIs: 1,
      draftAsIsRate: 0.5,
      activeDays: 2,
      ledgerDays: 1,
      expenses: 3,
      digitalExpenses: 2,
      expenseDigitalRate: 0.667,
      attendance: 2,
      attendanceApp: 1,
      attendanceAppRate: 0.5,
      rating: 4.4,
      ratingDelta: 0.2,
      aiDrafts: 1,
    });
    // 2주 차는 진행 중 (오늘까지 4일), 3주 차부터는 아직
    expect(w2).toMatchObject({ week: 2, days: 4, partial: true, reviews: 0, responseRate: null });
    expect(w3).toMatchObject({ week: 3, future: true });

    // 설문 값 — 보낸 칸만, null 은 비움
    await http
      .put(api(`/admin/properties/${pid}/pilot-survey`))
      .set(superAuth)
      .send({ channelCheckMinutes: 60, payrollMethod: '엑셀', satisfaction4w: 4, wtpPlan: '베이직', wtpProperties: 2 })
      .expect(200);
    const s2 = await http
      .put(api(`/admin/properties/${pid}/pilot-survey`))
      .set(superAuth)
      .send({ payrollMethod: null, satisfaction8w: 5 })
      .expect(200);
    expect(s2.body).toMatchObject({
      channelCheckMinutes: 60,
      payrollMethod: null,
      satisfaction4w: 4,
      satisfaction8w: 5,
      wtpPlan: '베이직',
    });
    await http
      .put(api(`/admin/properties/${pid}/pilot-survey`))
      .set(superAuth)
      .send({ satisfaction4w: 6 })
      .expect(400);

    // 해제
    const off = await setPilot(pid, null);
    expect(off.body.pilot).toBeNull();
  });

  it('PO-09 실증 업장은 실증 끝날 때까지 결제하지 않는다 — 끝나면 정기결제가 이어 받음', async () => {
    const u = await signup('010-8600-0006', '결제 사장');
    const pid = await property(u.auth, '605500550', '결제 호텔');
    const billing = app.get(BillingService);
    await billing.setCard(pid, 'pilot-card');
    await prisma.subscription.updateMany({
      where: { propertyId: pid },
      data: { trialEndsAt: dateOnly(addDaysIso(today, -1)) },
    });
    const start = addDaysIso(today, -10);
    await setPilot(pid, '테스트 실증 B', start);
    const endsAt = addDaysIso(start, 55);

    expect(await billing.billProperty(pid, today, true)).toBeNull();
    await billing.runDaily(today);
    // 실증 중 새 서비스를 켜도 결제 없이 체험으로
    await http
      .put(api(`/properties/${pid}/subscriptions/STAFF`))
      .set(u.auth)
      .send({ enabled: true })
      .expect(200);
    expect(await prisma.payment.count({ where: { propertyId: pid } })).toBe(0);
    const b = await http
      .get(api(`/properties/${pid}/billing`))
      .set(u.auth)
      .expect(200);
    expect(b.body).toMatchObject({ trialDays: 30, billingHeld: true, pilot: { endsAt, active: true } });
    expect(b.body.nextBilling >= addDaysIso(endsAt, 1)).toBe(true);
    expect(b.body.subscriptions.find((s: { planCode: string }) => s.planCode === 'STAFF').status).toBe('TRIAL');

    // 실증 끝난 다음 날 — 결제
    const r = await billing.billProperty(pid, addDaysIso(endsAt, 1), true);
    expect(r).toMatchObject({ ok: true });
    expect(await prisma.payment.count({ where: { propertyId: pid, status: 'PAID' } })).toBe(1);
  });

  it('PO-10 체험 종료 3일 전 알림 — 사장님에게만, 한 번만 (실증 업장 제외)', async () => {
    const u = await signup('010-8600-0007', '체험 사장');
    const pid = await property(u.auth, '606600660', '체험 호텔');
    const pilotPid = await property(u.auth, '606600670', '체험 실증 호텔');
    await setPilot(pilotPid, '테스트 실증 C', today);
    const inv = await http
      .post(api(`/properties/${pid}/invitations`))
      .set(u.auth)
      .send({ phone: '010-8600-0008', role: 'MANAGER' })
      .expect(201);
    const mgr = await signup('010-8600-0008', '체험 매니저');
    await http.post(api('/invitations/accept')).set(mgr.auth).send({ token: inv.body.devToken }).expect(200);
    await prisma.subscription.updateMany({
      where: { propertyId: { in: [pid, pilotPid] } },
      data: { trialEndsAt: dateOnly(addDaysIso(today, 3)) },
    });
    const billing = app.get(BillingService);
    const first = await billing.notifyTrialEnding(today);
    expect(first.sent).toBeGreaterThanOrEqual(1);
    const notes = await prisma.notification.findMany({
      where: { propertyId: { in: [pid, pilotPid] }, kind: 'BILLING' },
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ propertyId: pid, userId: u.userId, link: '/app/settings/billing' });
    expect(notes[0].text).toContain('무료 체험이');
    expect(notes[0].text).toContain('결제 카드를 등록해 주세요'); // 카드가 없으니
    await billing.notifyTrialEnding(today);
    await billing.notifyTrialEnding(addDaysIso(today, 1));
    expect(await prisma.notification.count({ where: { propertyId: pid, kind: 'BILLING' } })).toBe(1);
  });

  it('PO-13 · PO-20 답글 설정·알림 설정 applyTo — 내 업장만, 아니면 403 (아무것도 안 바뀜)', async () => {
    const u = await signup('010-8600-0009', '적용 사장');
    const a = await property(u.auth, '607700770', '적용 A');
    const b = await property(u.auth, '607700780', '적용 B');
    const other = await signup('010-8600-0010', '남의 사장');
    const c = await property(other.auth, '607700790', '남의 업장');
    const body = {
      tone: 'FRIENDLY',
      signature: '적용 A 드림',
      mustInclude: '또 오세요',
      banned: ['환불'],
      autoEnabled: true,
      autoMinRating: 5,
      autoHours: 'DAYTIME',
    };
    await http
      .get(api(`/properties/${b}/reply-settings`))
      .set(u.auth)
      .expect(200);
    await http
      .put(api(`/properties/${b}/reply-settings`))
      .set(u.auth)
      .send({ ...body, signature: '적용 B 드림', tone: 'POLITE' })
      .expect(200);

    await http
      .put(api(`/properties/${a}/reply-settings`))
      .set(u.auth)
      .send({ ...body, applyTo: [b, c] })
      .expect(403);
    const untouched = await prisma.replySettings.findUnique({ where: { propertyId: b } });
    expect(untouched).toMatchObject({ tone: 'POLITE', signature: '적용 B 드림' });

    const ok = await http
      .put(api(`/properties/${a}/reply-settings`))
      .set(u.auth)
      .send({ ...body, applyTo: [b, a] })
      .expect(200);
    expect(ok.body).toMatchObject({ propertyId: a, signature: '적용 A 드림', appliedTo: [b] });
    expect(await prisma.replySettings.findUnique({ where: { propertyId: b } })).toMatchObject({
      tone: 'FRIENDLY',
      mustInclude: '또 오세요',
      banned: ['환불'],
      autoEnabled: true,
      autoMinRating: 5,
      autoHours: 'DAYTIME',
      signature: '적용 B 드림',
    });
    expect(await prisma.replySettings.findUnique({ where: { propertyId: c } })).toMatchObject({
      tone: 'POLITE',
      mustInclude: '',
    });

    // 알림 설정
    const items = [{ kind: 'SUMMARY', alimtalk: false, push: false, email: false }];
    await http
      .put(api(`/properties/${a}/notification-settings`))
      .set(u.auth)
      .send({ items, applyTo: [c] })
      .expect(403);
    const n = await http
      .put(api(`/properties/${a}/notification-settings`))
      .set(u.auth)
      .send({ items, applyTo: [b] })
      .expect(200);
    expect(n.body).toHaveLength(6);
    const nb = await http
      .get(api(`/properties/${b}/notification-settings`))
      .set(u.auth)
      .expect(200);
    expect(nb.body.find((x: { kind: string }) => x.kind === 'SUMMARY')).toMatchObject({ push: false });
    expect(await prisma.notificationSetting.count({ where: { propertyId: c } })).toBe(0);
  });

  it('PO-22 아침 요약 — 업장마다 한 줄씩 한 건으로, 하루 한 번, 아침 요약 끈 업장은 빠짐', async () => {
    const u = await signup('010-8600-0011', '요약 사장');
    const a = await property(u.auth, '608800880', '요약 A');
    const b = await property(u.auth, '608800890', '요약 B');
    const yesterday = addDaysIso(today, -1);
    await prisma.booking.create({
      data: {
        propertyId: a,
        channel: 'YANOLJA',
        reservationNo: 'sum-1',
        guestName: '김*',
        roomType: '더블',
        checkinDate: dateOnly(yesterday),
        checkoutDate: dateOnly(today),
        saleAmount: 120_000,
        bookedAt: new Date(),
      },
    });
    await prisma.review.create({
      data: {
        propertyId: b,
        channel: 'NAVER',
        externalId: 'sum-r',
        author: '손님',
        rating: 2,
        body: '별로',
        photos: [],
        postedAt: new Date(),
        sentiment: 'IMPROVE',
      },
    });
    await prisma.room.create({
      data: { propertyId: b, number: '201', status: 'DIRTY', statusChangedAt: new Date(Date.now() - 5 * 3_600_000) },
    });
    const summary = app.get(DailySummaryService);
    expect(await summary.sendTo(u.userId)).toBe(true);
    expect(await summary.sendTo(u.userId)).toBe(false);
    const rows = await prisma.notification.findMany({ where: { userId: u.userId, kind: 'SUMMARY' } });
    expect(rows).toHaveLength(1);
    const lines = rows[0].text.split('\n');
    expect(lines[0]).toMatch(/^아침 요약 \d+월 \d+일, 업장 2곳$/);
    expect(lines.slice(1)).toEqual([
      '요약 A: 어제 매출 ₩120,000, 미답변 0건',
      '요약 B: 어제 매출 ₩0, 미답변 1건, 청소 지연 1실',
    ]);
    expect(rows[0]).toMatchObject({ propertyId: a, link: '/app/overview' });
    // 알림 목록에도 나온다
    const list = await http.get(api('/notifications')).set(u.auth).expect(200);
    expect(list.body.items.some((x: { kind: string }) => x.kind === 'SUMMARY')).toBe(true);

    // B 는 아침 요약 끔 → 다음 날 A 한 줄만, 링크는 업장 홈
    await http
      .put(api(`/properties/${b}/notification-settings`))
      .set(u.auth)
      .send({ items: [{ kind: 'SUMMARY', alimtalk: false, push: false, email: false }] })
      .expect(200);
    const tomorrow = new Date(Date.now() + 86_400_000);
    expect(await summary.sendTo(u.userId, tomorrow)).toBe(true);
    const next = await prisma.notification.findFirstOrThrow({
      where: { userId: u.userId, kind: 'SUMMARY' },
      orderBy: { createdAt: 'desc' },
    });
    expect(next.text.split('\n')).toHaveLength(2);
    expect(next.link).toBe('/app');
  });

  it('PO-21 /portfolio 이번 달 지출·인건비(확정 우선, 없으면 계산 중) · 매출 대비 비율', async () => {
    const u = await signup('010-8600-0012', '비용 사장');
    const pid = await property(u.auth, '609900990', '비용 호텔');
    await prisma.booking.create({
      data: {
        propertyId: pid,
        channel: 'YANOLJA',
        reservationNo: 'cost-1',
        guestName: '김*',
        roomType: '더블',
        checkinDate: dateOnly(today),
        checkoutDate: dateOnly(addDaysIso(today, 1)),
        saleAmount: 1_000_000,
        bookedAt: new Date(),
      },
    });
    await prisma.expense.create({
      data: { propertyId: pid, expenseDate: dateOnly(today), vendor: '가게', category: 'AMENITY', amount: 100_000 },
    });
    const emp = await http
      .post(api(`/properties/${pid}/staff/employees`))
      .set(u.auth)
      .send({
        name: '비용알바',
        phone: '010-8600-0098',
        jobRole: 'FRONT',
        payType: 'HOURLY',
        payAmount: 11_000,
        hiredDate: addDaysIso(today, -60),
      })
      .expect(201);
    const monthStartDate = dateOnly(`${today.slice(0, 7)}-01`);
    const payroll = { workHours: 10, nightHours: 0, baseAmount: 0, nightAmount: 0, weeklyAmount: 0 };
    await prisma.payroll.create({
      data: { employeeId: emp.body.id, month: monthStartDate, ...payroll, totalAmount: 200_000 },
    });
    let p = await http.get(api('/portfolio')).set(u.auth).expect(200);
    expect(p.body.properties[0].costs).toEqual({
      expenses: 100_000,
      payroll: 200_000,
      payrollStatus: 'DRAFT',
      costRatio: 0.3,
    });
    await prisma.payroll.updateMany({
      where: { employeeId: emp.body.id },
      data: { status: 'CONFIRMED', totalAmount: 150_000 },
    });
    p = await http.get(api('/portfolio')).set(u.auth).expect(200);
    expect(p.body.properties[0].costs).toEqual({
      expenses: 100_000,
      payroll: 150_000,
      payrollStatus: 'CONFIRMED',
      costRatio: 0.25,
    });
    expect(p.body.totals.costs).toEqual({
      expenses: 100_000,
      payroll: 150_000,
      payrollStatus: 'CONFIRMED',
      costRatio: 0.25,
    });
    const r = await http.get(api('/portfolio/report')).set(u.auth).expect(200);
    expect(r.body.properties[0].costs).toMatchObject({
      expenses: 100_000,
      payroll: 150_000,
      payrollStatus: 'CONFIRMED',
    });
  });

  it('PO-23 지원 메모 — 운영자만 (사장님 토큰 401), 지우기는 쓴 사람·최고 관리자', async () => {
    const u = await signup('010-8600-0013', '메모 사장');
    const pid = await property(u.auth, '610000100', '메모 호텔');
    await http
      .get(api(`/admin/properties/${pid}/notes`))
      .set(u.auth)
      .expect(401);
    await http
      .post(api(`/admin/properties/${pid}/notes`))
      .set(u.auth)
      .send({ kind: 'CALL', body: 'x' })
      .expect(401);
    await http.get(api(`/admin/properties/${pid}/notes`)).expect(401);

    const a = await http
      .post(api(`/admin/properties/${pid}/notes`))
      .set(superAuth)
      .send({ kind: 'CALL', body: '  채널 연결 도와드림  ' })
      .expect(201);
    expect(a.body).toMatchObject({ kind: 'CALL', body: '채널 연결 도와드림', admin: { name: '실증 관리자' } });
    const b = await http
      .post(api(`/admin/properties/${pid}/notes`))
      .set(operatorAuth)
      .send({ kind: 'VISIT', body: '현장 방문' })
      .expect(201);
    await http
      .post(api(`/admin/properties/${pid}/notes`))
      .set(superAuth)
      .send({ kind: 'MAIL', body: 'x' })
      .expect(400);
    const list = await http
      .get(api(`/admin/properties/${pid}/notes`))
      .set(operatorAuth)
      .expect(200);
    expect(list.body.map((x: { id: string }) => x.id)).toEqual([b.body.id, a.body.id]);
    const detail = await http
      .get(api(`/admin/properties/${pid}`))
      .set(operatorAuth)
      .expect(200);
    expect(detail.body.notes).toHaveLength(2);

    await http
      .delete(api(`/admin/properties/${pid}/notes/${a.body.id}`))
      .set(operatorAuth)
      .expect(403);
    await http
      .delete(api(`/admin/properties/${pid}/notes/${b.body.id}`))
      .set(operatorAuth)
      .expect(204);
    await http
      .delete(api(`/admin/properties/${pid}/notes/${a.body.id}`))
      .set(superAuth)
      .expect(204);
    expect(
      (
        await http
          .get(api(`/admin/properties/${pid}/notes`))
          .set(superAuth)
          .expect(200)
      ).body,
    ).toEqual([]);
  });

  it('PO-18 연락할 곳 — 채널 미연결 72시간 · 3일 미접속', async () => {
    const u = await signup('010-8600-0014', '연락 사장');
    const pid = await property(u.auth, '610000200', '연락 호텔');
    await prisma.property.update({ where: { id: pid }, data: { createdAt: new Date(Date.now() - 80 * 3_600_000) } });
    await prisma.user.update({ where: { id: u.userId }, data: { lastLoginAt: new Date(Date.now() - 4 * 86_400_000) } });
    const r = await http.get(api('/admin/attention')).set(superAuth).expect(200);
    const row = r.body.items.find((x: { property: { id: string } }) => x.property.id === pid);
    expect(row.reasons.map((x: { kind: string }) => x.kind)).toEqual(['NO_CHANNEL', 'NO_LOGIN']);
    expect(row.owner).toMatchObject({ name: '연락 사장', phone: '01086000014' });
  });
});
