import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createAdminUser } from '../src/admin/admin-auth.service.js';
import { AppModule } from '../src/app.module.js';
import { isValidBizNo } from '../src/common/utils/biz-no.js';
import { SampleChannelConnector } from '../src/connectors/sample-connector.js';
import { BillingService } from '../src/billing/billing.service.js';
import { FakePaymentGateway } from '../src/billing/payment-gateway.js';
import { addDaysIso, addMonths, kstDate } from '../src/common/utils/dates.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';
import { ConsoleSmsSender } from '../src/sms/sms-sender.js';

/** 검증번호가 맞는 사업자등록번호 만들기 */
function validBizNo(prefix = '123456789'): string {
  for (let d = 0; d <= 9; d++) if (isValidBizNo(prefix + d)) return prefix + d;
  throw new Error('no');
}

describe('우주스테이 API (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let sms: ConsoleSmsSender;
  let connector: SampleChannelConnector;
  const api = (path: string) => `/api/v1${path}`;

  /** 가입까지 마친 사용자 */
  async function signup(phone: string, name: string) {
    const sent = await http.post(api('/auth/phone/send-code')).send({ phone, purpose: 'signup' }).expect(200);
    expect(sent.body.devCode).toMatch(/^\d{6}$/);
    expect(sms.lastTo(phone.replace(/\D/g, ''))).toContain(sent.body.devCode);
    const verified = await http
      .post(api('/auth/phone/verify'))
      .send({ phone, purpose: 'signup', code: sent.body.devCode })
      .expect(200);
    const res = await http
      .post(api('/auth/signup'))
      .send({
        verificationToken: verified.body.verificationToken,
        name,
        password: 'woojoo1234',
        agreements: { terms: true, privacy: true, marketing: false },
      })
      .expect(201);
    return { token: res.body.accessToken as string, refresh: res.body.refreshToken as string, user: res.body.user };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(moduleRef.createNestApplication());
    await app.init();
    http = request(app.getHttpServer());
    sms = app.get(ConsoleSmsSender);
    connector = app.get(SampleChannelConnector);
  });

  afterAll(async () => {
    await app.close();
  });

  let owner: Awaited<ReturnType<typeof signup>>;
  let propertyId: string;
  const auth = () => ({ Authorization: `Bearer ${owner.token}` });

  describe('회원가입·로그인 (F0-01, F0-17)', () => {
    it('인증번호가 틀리면 거절, 맞으면 가입', async () => {
      await http.post(api('/auth/phone/send-code')).send({ phone: '010-9999-0000', purpose: 'signup' }).expect(200);
      const bad = await http
        .post(api('/auth/phone/verify'))
        .send({ phone: '010-9999-0000', purpose: 'signup', code: '000000' })
        .expect(400);
      // 아주 작은 확률로 실제 코드가 000000 일 수 있으므로 코드 형식만 확인
      expect(['CODE_INVALID']).toContain(bad.body.errorCode);
      owner = await signup('010-1234-5678', '정현');
      expect(owner.user.phone).toBe('01012345678');
    });

    it('같은 번호로 다시 가입할 수 없다', async () => {
      const res = await http
        .post(api('/auth/phone/send-code'))
        .send({ phone: '01012345678', purpose: 'signup' })
        .expect(409);
      expect(res.body.errorCode).toBe('PHONE_TAKEN');
    });

    it('필수 약관 미동의면 가입 불가', async () => {
      const sent = await http.post(api('/auth/phone/send-code')).send({ phone: '010-5555-0001', purpose: 'signup' });
      const v = await http
        .post(api('/auth/phone/verify'))
        .send({ phone: '010-5555-0001', purpose: 'signup', code: sent.body.devCode });
      const res = await http
        .post(api('/auth/signup'))
        .send({
          verificationToken: v.body.verificationToken,
          name: '테스트',
          password: 'abcd1234',
          agreements: { terms: true, privacy: false, marketing: false },
        })
        .expect(400);
      expect(res.body.errorCode).toBe('TERMS_REQUIRED');
    });

    it('로그인 · 비밀번호 틀림 · 토큰 갱신(1회용)', async () => {
      await http.post(api('/auth/login')).send({ phone: '010-1234-5678', password: 'nope1234' }).expect(401);
      const login = await http
        .post(api('/auth/login'))
        .send({ phone: '010-1234-5678', password: 'woojoo1234' })
        .expect(200);
      const r1 = await http.post(api('/auth/refresh')).send({ refreshToken: login.body.refreshToken }).expect(200);
      expect(r1.body.accessToken).toBeTruthy();
      // 이미 쓴 리프레시 토큰을 30초 안에 다시 쓰면(동시 갱신) 그 요청만 거절 — 새 토큰은 살아 있다
      await http.post(api('/auth/refresh')).send({ refreshToken: login.body.refreshToken }).expect(401);
      const r2 = await http.post(api('/auth/refresh')).send({ refreshToken: r1.body.refreshToken }).expect(200);
      // 30초가 지나 다시 쓰면 탈취로 보고 새 토큰까지 모두 끊긴다
      const prisma = app.get(PrismaService);
      await prisma.refreshToken.updateMany({
        where: { userId: owner.user.id, isRotated: true },
        data: { revokedAt: new Date(Date.now() - 60_000) },
      });
      await http.post(api('/auth/refresh')).send({ refreshToken: login.body.refreshToken }).expect(401);
      await http.post(api('/auth/refresh')).send({ refreshToken: r2.body.refreshToken }).expect(401);
    });

    it('로그아웃한 토큰을 다시 쓰면 그 토큰만 거절 — 다른 기기 세션은 그대로', async () => {
      const a = await http
        .post(api('/auth/login'))
        .send({ phone: '010-1234-5678', password: 'woojoo1234' })
        .expect(200);
      const b = await http
        .post(api('/auth/login'))
        .send({ phone: '010-1234-5678', password: 'woojoo1234' })
        .expect(200);
      await http.post(api('/auth/logout')).send({ refreshToken: a.body.refreshToken }).expect(204);
      const reuse = await http.post(api('/auth/refresh')).send({ refreshToken: a.body.refreshToken }).expect(401);
      expect(reuse.body.errorCode).toBe('TOKEN_INVALID');
      await http.post(api('/auth/refresh')).send({ refreshToken: b.body.refreshToken }).expect(200);
    });

    it('토큰 없이는 401', async () => {
      await http.get(api('/auth/me')).expect(401);
    });
  });

  describe('업장 (F0-02)', () => {
    it('사업자번호 검증번호가 틀리면 등록 불가', async () => {
      const wrong = validBizNo().slice(0, 9) + ((Number(validBizNo().slice(9)) + 1) % 10);
      const res = await http
        .post(api('/properties'))
        .set(auth())
        .send({
          name: '스테이 오르빗 을지로',
          type: 'HOTEL',
          address: '서울 중구 을지로',
          rooms: 42,
          bizNo: wrong,
          ownerName: '정현',
        })
        .expect(400);
      expect(res.body.errorCode).toBe('BIZ_NO_INVALID');
    });

    it('등록하면 사장님 권한 + 답글 설정 기본값', async () => {
      const res = await http
        .post(api('/properties'))
        .set(auth())
        .send({
          name: '스테이 오르빗 을지로',
          type: 'HOTEL',
          address: '서울 중구 을지로',
          rooms: 42,
          bizNo: validBizNo(),
          ownerName: '정현',
        })
        .expect(201);
      propertyId = res.body.id;
      const me = await http.get(api('/auth/me')).set(auth()).expect(200);
      expect(me.body.properties).toEqual([expect.objectContaining({ id: propertyId, role: 'OWNER' })]);
      const s = await http
        .get(api(`/properties/${propertyId}/reply-settings`))
        .set(auth())
        .expect(200);
      expect(s.body.signature).toBe('스테이 오르빗 을지로 드림');
    });

    it('다른 사람의 업장은 보이지 않는다 (404)', async () => {
      const other = await signup('010-7777-8888', '다른사장');
      await http
        .get(api(`/properties/${propertyId}`))
        .set({ Authorization: `Bearer ${other.token}` })
        .expect(404);
      await http
        .get(api(`/properties/${propertyId}/reviews`))
        .set({ Authorization: `Bearer ${other.token}` })
        .expect(404);
    });
  });

  describe('채널 연동 · 리뷰 수집 (F0-04, F0-05)', () => {
    it('위탁 동의 없이는 연결 불가, 로그인 실패도 알려준다', async () => {
      await http
        .post(api(`/properties/${propertyId}/channels/YANOLJA/connect`))
        .set(auth())
        .send({ loginId: 'orbit', password: 'pw', consent: false })
        .expect(400);
      const res = await http
        .post(api(`/properties/${propertyId}/channels/YANOLJA/connect`))
        .set(auth())
        .send({ loginId: 'orbit', password: 'wrong', consent: true })
        .expect(400);
      expect(res.body.errorCode).toBe('CHANNEL_AUTH_FAILED');
    });

    it('연결하면 리뷰를 가져오고 AI 초안을 미리 만든다', async () => {
      for (const ch of ['YANOLJA', 'NAVER', 'AGODA']) {
        const r = await http
          .post(api(`/properties/${propertyId}/channels/${ch}/connect`))
          .set(auth())
          .send({ loginId: 'orbit', password: 'secret', consent: true })
          .expect(200);
        expect(r.body.status).toBe('CONNECTED');
      }
      const list = await http
        .get(api(`/properties/${propertyId}/reviews`))
        .set(auth())
        .expect(200);
      expect(list.body.counts).toEqual({ all: 5, unanswered: 5, positive: 3, improve: 2 });
      expect(list.body.items.every((r: { draft: unknown }) => r.draft)).toBe(true);
      const channels = await http
        .get(api(`/properties/${propertyId}/channels`))
        .set(auth())
        .expect(200);
      expect(channels.body).toHaveLength(9);
      expect(channels.body.filter((c: { connected: boolean }) => c.connected)).toHaveLength(3);
    });

    it('다시 수집해도 중복으로 쌓이지 않는다', async () => {
      await http
        .post(api(`/properties/${propertyId}/channels/YANOLJA/sync`))
        .set(auth())
        .expect(200);
      const list = await http.get(api(`/properties/${propertyId}/reviews`)).set(auth());
      expect(list.body.counts.all).toBe(5);
    });

    it('탭·채널·정렬 필터 (F1-01, F1-02)', async () => {
      const improve = await http.get(api(`/properties/${propertyId}/reviews?tab=improve&sort=low`)).set(auth());
      expect(improve.body.items.map((r: { rating: number }) => r.rating)).toEqual([2, 3]);
      const naver = await http.get(api(`/properties/${propertyId}/reviews?channel=NAVER`)).set(auth());
      expect(naver.body.items.every((r: { channel: string }) => r.channel === 'NAVER')).toBe(true);
    });
  });

  describe('AI 답글 · 게시 (F1-03, F1-04, F1-07)', () => {
    it('말투 설정을 바꾸면 다시 만든 초안에 반영된다', async () => {
      await http
        .put(api(`/properties/${propertyId}/reply-settings`))
        .set(auth())
        .send({
          tone: 'POLITE',
          signature: '오르빗 지배인 드림',
          mustInclude: '다음에도 편히 쉬어 가세요.',
          banned: ['환불'],
          autoEnabled: false,
          autoMinRating: 4,
          autoHours: 'ALWAYS',
        })
        .expect(200);
      const list = await http.get(api(`/properties/${propertyId}/reviews?channel=NAVER&sort=low`)).set(auth());
      const low = list.body.items[0];
      const redraft = await http
        .post(api(`/properties/${propertyId}/reviews/${low.id}/draft`))
        .set(auth())
        .expect(200);
      expect(redraft.body.draft.text).toContain('오르빗 지배인 드림');
      expect(redraft.body.draft.text).toContain('다음에도 편히 쉬어 가세요.');
      expect(redraft.body.draft.text).toContain('죄송');
      expect(redraft.body.draft.keywords).toContain('소음');
    });

    it('공식 답글 API 가 없는 채널은 복사 게시로 기록하고 파트너센터 주소를 준다', async () => {
      const list = await http.get(api(`/properties/${propertyId}/reviews`)).set(auth());
      const yanolja = list.body.items.find((r: { channel: string }) => r.channel === 'YANOLJA');
      const agoda = list.body.items.find((r: { channel: string }) => r.channel === 'AGODA');
      expect(yanolja.draft.generator).toBe('template');
      const p1 = await http
        .post(api(`/properties/${propertyId}/reviews/${yanolja.id}/reply`))
        .set(auth())
        .send({ text: yanolja.draft.text })
        .expect(201);
      // 야놀자는 공식 답글 API 가 확인되지 않아 복사 게시 (호텔스닷컴 API 게시는 hardening e2e)
      expect(p1.body.reply.via).toBe('COPY');
      expect(p1.body.copyTo).toContain('yanolja');
      expect(connector.posted.some((p) => p.text === yanolja.draft.text)).toBe(false);
      const p2 = await http
        .post(api(`/properties/${propertyId}/reviews/${agoda.id}/reply`))
        .set(auth())
        .send({ text: 'Thank you!' })
        .expect(201);
      expect(p2.body.reply.via).toBe('COPY');
      expect(p2.body.copyTo).toContain('agoda');
      const again = await http
        .post(api(`/properties/${propertyId}/reviews/${agoda.id}/reply`))
        .set(auth())
        .send({ text: 'x' })
        .expect(409);
      expect(again.body.errorCode).toBe('ALREADY_ANSWERED');
      const counts = (await http.get(api(`/properties/${propertyId}/reviews`)).set(auth())).body.counts;
      expect(counts.unanswered).toBe(3);
    });
  });

  describe('자동 응대 (F1-08)', () => {
    it('자동 응대는 공식 API 채널만 — 복사 채널(여기어때)은 켜 둬도 게시하지 않는다', async () => {
      await http
        .put(api(`/properties/${propertyId}/reply-settings`))
        .set(auth())
        .send({
          tone: 'FRIENDLY',
          signature: '오르빗 드림',
          mustInclude: '',
          banned: [],
          autoEnabled: true,
          autoMinRating: 4,
          autoHours: 'ALWAYS',
        })
        .expect(200);
      await http
        .post(api(`/properties/${propertyId}/channels/YEOGI/connect`))
        .set(auth())
        .send({ loginId: 'orbit', password: 'secret', consent: true })
        .expect(200);
      const yeogi = await http.get(api(`/properties/${propertyId}/reviews?channel=YEOGI`)).set(auth());
      const four = yeogi.body.items.find((r: { rating: number }) => r.rating === 4);
      const one = yeogi.body.items.find((r: { rating: number }) => r.rating === 1);
      expect(four.status).toBe('UNANSWERED');
      expect(four.draft.text).not.toMatch(/죄송|점검하겠/); // 4점 리뷰에 사과·개선 약속 없음
      expect(one.status).toBe('UNANSWERED');
      expect(one.needsReview).toBe(true);
    });
  });

  describe('직원 권한 (F0-03)', () => {
    it('직원 초대 → 수락 → 직원은 리뷰를 볼 수 없다', async () => {
      const inv = await http
        .post(api(`/properties/${propertyId}/invitations`))
        .set(auth())
        .send({ phone: '010-3333-4444', role: 'STAFF' })
        .expect(201);
      const staff = await signup('010-3333-4444', '김민지');
      const acc = await http
        .post(api('/invitations/accept'))
        .set({ Authorization: `Bearer ${staff.token}` })
        .send({ token: inv.body.devToken })
        .expect(200);
      expect(acc.body.role).toBe('STAFF');
      const res = await http
        .get(api(`/properties/${propertyId}/reviews`))
        .set({ Authorization: `Bearer ${staff.token}` })
        .expect(403);
      expect(res.body.errorCode).toBe('FORBIDDEN');
    });

    it('다른 번호로는 초대를 수락할 수 없다', async () => {
      const inv = await http
        .post(api(`/properties/${propertyId}/invitations`))
        .set(auth())
        .send({ phone: '010-4444-5555', role: 'MANAGER' });
      const someone = await signup('010-6666-7777', '아무개');
      await http
        .post(api('/invitations/accept'))
        .set({ Authorization: `Bearer ${someone.token}` })
        .send({ token: inv.body.devToken })
        .expect(403);
    });

    it('마지막 사장님 권한은 내릴 수 없다', async () => {
      const members = await http
        .get(api(`/properties/${propertyId}/members`))
        .set(auth())
        .expect(200);
      const me = members.body.members.find((m: { role: string }) => m.role === 'OWNER');
      const res = await http
        .patch(api(`/properties/${propertyId}/members/${me.id}`))
        .set(auth())
        .send({ role: 'MANAGER' })
        .expect(400);
      expect(res.body.errorCode).toBe('LAST_OWNER');
    });
  });

  describe('홈 대시보드 · 알림 (F0-12, F0-13)', () => {
    it('오늘 매출 · 미답변 · 정산 예정 · 연동 상태', async () => {
      const d = await http
        .get(api(`/properties/${propertyId}/dashboard`))
        .set(auth())
        .expect(200);
      expect(d.body.todaySales.amount).toBe(1_240_000 + 720_000 + 610_000 + 980_000);
      expect(d.body.todaySales.changeRate).toBeGreaterThan(0);
      expect(d.body.unanswered.total).toBe(5);
      expect(d.body.unanswered.lowRating).toBe(3);
      expect(d.body.channels).toHaveLength(4);
      expect(d.body.settlementWeek.count).toBe(4);
      expect(d.body.pendingReviews[0].rating).toBe(1);
    });

    it('새 리뷰·저평점 알림이 쌓이고 모두 읽음 처리', async () => {
      const n = await http
        .get(api(`/notifications?propertyId=${propertyId}`))
        .set(auth())
        .expect(200);
      expect(n.body.unread).toBeGreaterThan(0);
      expect(n.body.items.some((i: { text: string }) => i.text.includes('별점 3점 이하'))).toBe(true);
      await http
        .post(api(`/notifications/read-all?propertyId=${propertyId}`))
        .set(auth())
        .expect(204);
      const after = await http.get(api('/notifications')).set(auth());
      expect(after.body.unread).toBe(0);
    });
  });

  describe('운영자 (F0-14) · 도입 문의', () => {
    let adminToken: string;
    const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });

    it('문의는 로그인 없이 접수된다', async () => {
      await http
        .post(api('/inquiries'))
        .send({
          type: 'INTRO',
          contactName: '한소영',
          phone: '010-1234-5678',
          propertyName: '호텔 한결',
          rooms: 58,
          message: '도입 문의드려요',
        })
        .expect(201);
      await http.post(api('/inquiries')).send({ type: 'INTRO', contactName: '', phone: '12', message: '' }).expect(400);
      // 해외 번호도 받는다 (랜딩 영어·일본어·중국어)
      await http
        .post(api('/inquiries'))
        .send({ type: 'PARTNER', contactName: 'Tanaka', phone: '+81 90-1234-5678', message: 'partnership' })
        .expect(201);
    });

    it('운영자는 이메일로 로그인하고, 사장님 토큰과 서로 섞어 쓸 수 없다', async () => {
      await createAdminUser(app.get(PrismaService), {
        email: 'ops@woojoo.kr',
        name: '운영팀',
        password: 'Woojoo1234!',
        role: 'OPERATOR',
      });
      const bad = await http
        .post(api('/admin/auth/login'))
        .send({ email: 'ops@woojoo.kr', password: 'nope' })
        .expect(401);
      expect(bad.body.errorCode).toBe('BAD_CREDENTIALS');
      const res = await http
        .post(api('/admin/auth/login'))
        .send({ email: 'OPS@woojoo.kr ', password: 'Woojoo1234!' })
        .expect(200);
      adminToken = res.body.accessToken;
      expect(res.body.admin.role).toBe('OPERATOR');
      // 사장님 토큰으로 운영자 API 불가, 운영자 토큰으로 사장님 API 불가
      await http.get(api('/admin/overview')).set(auth()).expect(401);
      await http.get(api('/auth/me')).set(adminAuth()).expect(401);
      await http.get(api('/admin/overview')).expect(401);
    });

    it('업장 현황 · 수집 오류 · 문의 처리', async () => {
      const ov = await http.get(api('/admin/overview')).set(adminAuth()).expect(200);
      expect(ov.body.properties).toBeGreaterThan(0);
      expect(ov.body.newInquiries).toBe(2);

      const list = await http.get(api('/admin/properties')).set(adminAuth()).expect(200);
      const mine = list.body.find((p: { id: string }) => p.id === propertyId);
      expect(mine.channelCount).toBeGreaterThan(0);

      const detail = await http
        .get(api(`/admin/properties/${propertyId}`))
        .set(adminAuth())
        .expect(200);
      expect(detail.body.members.length).toBeGreaterThan(0);

      const issues = await http.get(api('/admin/sync-issues')).set(adminAuth()).expect(200);
      expect(Array.isArray(issues.body)).toBe(true);

      const inq = await http.get(api('/admin/inquiries?status=NEW')).set(adminAuth()).expect(200);
      const id = inq.body.items[0].id;
      const upd = await http
        .patch(api(`/admin/inquiries/${id}`))
        .set(adminAuth())
        .send({ status: 'CONTACTED', adminMemo: '11/11 통화 예정' })
        .expect(200);
      expect(upd.body.handledBy.name).toBe('운영팀');
    });

    it('운영자 추가는 최고 관리자만', async () => {
      const res = await http
        .post(api('/admin/admins'))
        .set(adminAuth())
        .send({ email: 'new@woojoo.kr', name: '신규', password: 'Woojoo1234!' })
        .expect(403);
      expect(res.body.errorCode).toBe('ADMIN_FORBIDDEN');
    });
  });
  describe('매출장부 (F2-01 ~ F2-06)', () => {
    it('월 매출 · 채널별 · 추이 · 정산 달력 · 가격 비교 · 대실', async () => {
      const month = kstDate().slice(0, 7);
      const res = await http
        .get(api(`/properties/${propertyId}/ledger?month=${month}`))
        .set(auth())
        .expect(200);
      const l = res.body;
      expect(l.month).toBe(month);
      expect(l.sales).toBeGreaterThan(0);
      expect(l.sales).toBe(l.channels.reduce((s: number, c: { sales: number }) => s + c.sales, 0));
      expect(l.trend).toHaveLength(10);
      expect(l.trend[9]).toEqual({ month, sales: l.sales });
      expect(l.channels[0].feeRate).toBeGreaterThan(0);
      expect(l.priceCompare.rooms.length).toBeGreaterThan(0);
      expect(l.priceCompare.competitors.length).toBeGreaterThan(0);
      expect(l.stayMix.hourly).toHaveLength(13);
      expect(l.stayMix.overnight.count).toBeGreaterThan(0);
    });

    it('광고비 직접 입력이 반영된다', async () => {
      const month = kstDate().slice(0, 7);
      await http
        .put(api(`/properties/${propertyId}/ledger/ad-spend`))
        .set(auth())
        .send({ channel: 'KKUL', month, amount: 77_000 })
        .expect(200);
      const res = await http.get(api(`/properties/${propertyId}/ledger`)).set(auth());
      expect(res.body.channels.find((c: { channel: string }) => c.channel === 'KKUL').adSpend).toBe(77_000);
    });
  });

  describe('알바관리 (F5-01 ~ F5-06)', () => {
    let employeeId: string;

    it('직원 등록 — 최저시급 미만 경고', async () => {
      const low = await http
        .post(api(`/properties/${propertyId}/staff/employees`))
        .set(auth())
        .send({
          name: '정유나',
          phone: '010-7777-8888',
          jobRole: 'HOUSEKEEPING',
          payType: 'HOURLY',
          payAmount: 10_000,
          hiredDate: '2026-10-01',
        })
        .expect(201);
      expect(low.body.belowMinimumWage).toBe(true);
      const ok = await http
        .post(api(`/properties/${propertyId}/staff/employees`))
        .set(auth())
        .send({
          name: '김민지',
          phone: '010-3333-4444',
          jobRole: 'FRONT',
          payType: 'HOURLY',
          payAmount: 11_000,
          hiredDate: '2026-10-01',
        })
        .expect(201);
      expect(ok.body.belowMinimumWage).toBe(false);
      expect(ok.body.userId).not.toBeNull(); // 앱 계정(직원)과 연결됨
      employeeId = ok.body.id;
    });

    it('근로계약서 보내기 → 문자 링크 → 직원 서명', async () => {
      const sent = await http
        .post(api(`/properties/${propertyId}/staff/employees/${employeeId}/contract`))
        .set(auth())
        .expect(200);
      expect(sms.lastTo('01033334444')).toContain('근로계약서');
      const view = await http.get(api(`/contracts/${sent.body.devToken}`)).expect(200);
      expect(view.body.payText).toBe('시급 11,000원');
      await http
        .post(api(`/contracts/${sent.body.devToken}/sign`))
        .send({ signerName: '다른사람' })
        .expect(400);
      const signed = await http
        .post(api(`/contracts/${sent.body.devToken}/sign`))
        .send({ signerName: '김민지' })
        .expect(200);
      expect(signed.body.status).toBe('SIGNED');
    });

    it('직원 본인이 출근 → 중복 출근 불가 → 퇴근, 남의 기록은 못 찍는다', async () => {
      const login = await http
        .post(api('/auth/login'))
        .send({ phone: '010-3333-4444', password: 'woojoo1234' })
        .expect(200);
      const staffAuth = { Authorization: `Bearer ${login.body.accessToken}` };
      await http
        .post(api(`/properties/${propertyId}/staff/attendance/clock`))
        .set(staffAuth)
        .send({ employeeId, action: 'in' })
        .expect(200);
      await http
        .post(api(`/properties/${propertyId}/staff/attendance/clock`))
        .set(staffAuth)
        .send({ employeeId, action: 'in' })
        .expect(409);
      await http
        .post(api(`/properties/${propertyId}/staff/attendance/clock`))
        .set(staffAuth)
        .send({ employeeId, action: 'out' })
        .expect(200);
      const other = await http.get(api(`/properties/${propertyId}/staff`)).set(auth());
      const yuna = other.body.members.find((m: { name: string }) => m.name === '정유나');
      await http
        .post(api(`/properties/${propertyId}/staff/attendance/clock`))
        .set(staffAuth)
        .send({ employeeId: yuna.id, action: 'in' })
        .expect(403);
      // 직원은 알바관리 화면을 볼 수 없다
      await http
        .get(api(`/properties/${propertyId}/staff`))
        .set(staffAuth)
        .expect(403);
      const me = await http
        .get(api(`/properties/${propertyId}/staff/me`))
        .set(staffAuth)
        .expect(200);
      expect(me.body.employee.name).toBe('김민지');
      expect(me.body.state).toBe('done');
      expect(me.body.records[0].out).not.toBeNull();
      expect(me.body.week.shifts).toHaveLength(7);
      // 직원 명단에 없는 사장님은 404
      await http
        .get(api(`/properties/${propertyId}/staff/me`))
        .set(auth())
        .expect(404);
    });

    it('기록 수정 · 근무표 · 급여 계산 → 확정(지난달만·최저시급) → 확정 풀기 → 명세 발송', async () => {
      const yesterday = addDaysIso(kstDate(), -1);
      const month = kstDate().slice(0, 7);
      const prevMonth = addMonths(month, -1);
      const edited = await http
        .put(api(`/properties/${propertyId}/staff/attendance`))
        .set(auth())
        .send({ employeeId, workDate: yesterday, clockIn: '21:00', clockOut: '05:00', memo: '퇴근 누락 보정' })
        .expect(200);
      expect(edited.body.method).toBe('MANUAL');
      expect(edited.body.editedById).toBe(owner.user.id);
      // 지난달 기록
      await http
        .put(api(`/properties/${propertyId}/staff/attendance`))
        .set(auth())
        .send({ employeeId, workDate: `${prevMonth}-20`, clockIn: '09:00', clockOut: '18:00' })
        .expect(200);
      await http
        .put(api(`/properties/${propertyId}/staff/shifts`))
        .set(auth())
        .send({ employeeId, workDate: kstDate(), shiftType: 'NIGHT' })
        .expect(200);

      const ov = await http
        .get(api(`/properties/${propertyId}/staff`))
        .set(auth())
        .expect(200);
      expect(ov.body.minimumWage).toBe(10_320);
      expect(ov.body.week.dates).toHaveLength(7);
      expect(ov.body.week.shifts[employeeId]).toContain('NIGHT');
      expect(ov.body.missingClockOut).toEqual([]);

      await http
        .post(api(`/properties/${propertyId}/staff/payroll/${month}/send`))
        .set(auth())
        .expect(400);
      const calc = await http
        .post(api(`/properties/${propertyId}/staff/payroll/${month}/calculate`))
        .set(auth())
        .expect(200);
      const mine = calc.body.items.find((i: { employeeId: string }) => i.employeeId === employeeId);
      // 어제 21~05시 → 8시간 중 야간 7시간 (22~05), 이번 달이 아니면 0
      if (yesterday.startsWith(month)) {
        expect(mine.hours).toBeGreaterThanOrEqual(8);
        expect(mine.nightHours).toBeGreaterThanOrEqual(7);
        expect(mine.night).toBe(Math.round(mine.nightHours * 11_000 * 0.5));
      }
      expect(mine.status).toBe('DRAFT');
      // 아직 안 끝난 달은 확정할 수 없다
      const early = await http
        .post(api(`/properties/${propertyId}/staff/payroll/${month}/confirm`))
        .set(auth())
        .expect(400);
      expect(early.body.errorCode).toBe('MONTH_NOT_ENDED');
      // 지난달: 최저시급 미만(정유나 10,000원)이 있으면 확정 불가 → 시급 고치고 확정
      const low = await http
        .post(api(`/properties/${propertyId}/staff/payroll/${prevMonth}/confirm`))
        .set(auth())
        .expect(400);
      expect(low.body.errorCode).toBe('BELOW_MINIMUM_WAGE');
      const yuna = ov.body.members.find((m: { name: string }) => m.name === '정유나');
      await http
        .patch(api(`/properties/${propertyId}/staff/employees/${yuna.id}`))
        .set(auth())
        .send({ payAmount: 10_320 })
        .expect(200);
      const confirmed = await http
        .post(api(`/properties/${propertyId}/staff/payroll/${prevMonth}/confirm`))
        .set(auth())
        .expect(200);
      const minePrev = confirmed.body.items.find((i: { employeeId: string }) => i.employeeId === employeeId);
      expect(minePrev.status).toBe('CONFIRMED');
      expect(minePrev.hours).toBeGreaterThanOrEqual(9);
      // 확정 풀기 → 다시 확정 → 명세 발송 → 보낸 뒤에는 풀 수 없다
      const reopened = await http
        .post(api(`/properties/${propertyId}/staff/payroll/${prevMonth}/reopen`))
        .set(auth())
        .expect(200);
      expect(reopened.body.items.every((i: { status: string }) => i.status === 'DRAFT')).toBe(true);
      await http
        .post(api(`/properties/${propertyId}/staff/payroll/${prevMonth}/confirm`))
        .set(auth())
        .expect(200);
      const sent = await http
        .post(api(`/properties/${propertyId}/staff/payroll/${prevMonth}/send`))
        .set(auth())
        .expect(200);
      expect(sent.body.items.every((i: { status: string }) => i.status === 'SENT')).toBe(true);
      expect(sms.lastTo('01033334444')).toContain('급여명세');
      const locked = await http
        .post(api(`/properties/${propertyId}/staff/payroll/${prevMonth}/reopen`))
        .set(auth())
        .expect(409);
      expect(locked.body.errorCode).toBe('PAYROLL_SENT');
    });
  });

  describe('지출관리 (F6-01 ~ F6-04)', () => {
    it('지출 등록 · 수정 · 월 합계', async () => {
      const today = kstDate();
      const e = await http
        .post(api(`/properties/${propertyId}/expenses`))
        .set(auth())
        .send({ date: today, vendor: '한국전력', category: 'UTILITY', amount: 1_200_000 })
        .expect(201);
      await http
        .put(api(`/properties/${propertyId}/expenses/${e.body.id}`))
        .set(auth())
        .send({ date: today, vendor: '한국전력', category: 'UTILITY', amount: 1_240_000 })
        .expect(200);
      const m = await http
        .get(api(`/properties/${propertyId}/expenses`))
        .set(auth())
        .expect(200);
      expect(m.body.total).toBe(1_240_000);
      expect(m.body.byCategory[0]).toEqual({ category: 'UTILITY', amount: 1_240_000 });
      expect(m.body.sales).toBeGreaterThan(0);
    });

    it('영수증 올리기 → 확인 후 지출 등록 (두 번 등록 불가)', async () => {
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      );
      await http
        .post(api(`/properties/${propertyId}/receipts`))
        .set(auth())
        .attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' })
        .expect(400);
      const up = await http
        .post(api(`/properties/${propertyId}/receipts`))
        .set(auth())
        .attach('file', png, { filename: 'receipt.png', contentType: 'image/png' })
        .expect(201);
      expect(up.body.status).toBe('SCANNED');
      expect(up.body.reading.date).toBe(kstDate());
      const file = await http
        .get(api(`/properties/${propertyId}/receipts/${up.body.id}/file`))
        .set(auth())
        .expect(200);
      expect(file.headers['content-type']).toContain('image/png');
      const body = { date: kstDate(), vendor: '다이소', category: 'AMENITY', amount: 32_000 };
      const reg = await http
        .post(api(`/properties/${propertyId}/receipts/${up.body.id}/register`))
        .set(auth())
        .send(body)
        .expect(201);
      expect(reg.body.source).toBe('RECEIPT');
      await http
        .post(api(`/properties/${propertyId}/receipts/${up.body.id}/register`))
        .set(auth())
        .send(body)
        .expect(409);
    });

    it('발주 → 발주함 → 입고 확인하면 지출로 자동 등록', async () => {
      const o = await http
        .post(api(`/properties/${propertyId}/orders`))
        .set(auth())
        .send({ item: '일회용 칫솔', qty: 10, unit: '박스', vendor: '한빛어메니티', amount: 180_000 })
        .expect(201);
      await http
        .patch(api(`/properties/${propertyId}/orders/${o.body.id}`))
        .set(auth())
        .send({ status: 'ORDERED' })
        .expect(200);
      const r = await http
        .patch(api(`/properties/${propertyId}/orders/${o.body.id}`))
        .set(auth())
        .send({ status: 'RECEIVED' })
        .expect(200);
      expect(r.body.expenseId).toBeTruthy();
      await http
        .patch(api(`/properties/${propertyId}/orders/${o.body.id}`))
        .set(auth())
        .send({ status: 'CANCELLED' })
        .expect(409);
      const m = await http.get(api(`/properties/${propertyId}/expenses`)).set(auth());
      expect(
        m.body.items.some((i: { source: string; amount: number }) => i.source === 'ORDER' && i.amount === 180_000),
      ).toBe(true);
    });
  });

  describe('현장 업무 — 객실 상태 · 인수인계 · 공지 (F7-01 ~ F7-03)', () => {
    let staffAuth: Record<string, string>;
    let roomId: string;

    beforeAll(async () => {
      const login = await http.post(api('/auth/login')).send({ phone: '010-3333-4444', password: 'woojoo1234' });
      staffAuth = { Authorization: `Bearer ${login.body.accessToken}` };
    });

    it('객실 등록 — 같은 호수는 거절, 직원은 등록 불가', async () => {
      await http
        .post(api(`/properties/${propertyId}/rooms`))
        .set(auth())
        .send({
          rooms: [
            { number: '201', floor: 2, roomType: '스탠다드' },
            { number: '202', floor: 2 },
            { number: '301', floor: 3 },
          ],
        })
        .expect(201);
      const dup = await http
        .post(api(`/properties/${propertyId}/rooms`))
        .set(auth())
        .send({ rooms: [{ number: '202' }] })
        .expect(409);
      expect(dup.body.errorCode).toBe('ROOM_NO_TAKEN');
      await http
        .post(api(`/properties/${propertyId}/rooms`))
        .set(staffAuth)
        .send({ rooms: [{ number: '999' }] })
        .expect(403);
      const b = await http
        .get(api(`/properties/${propertyId}/ops`))
        .set(staffAuth)
        .expect(200);
      expect(b.body.rooms.map((r: { number: string }) => r.number)).toEqual(['201', '202', '301']);
      expect(b.body.counts.READY).toBe(3);
      roomId = b.body.rooms[0].id;
    });

    it('직원이 청소 → 점검 요청, 판매 중지는 사장님만 · 이력이 남는다', async () => {
      for (const status of ['DIRTY', 'CLEANING', 'INSPECT']) {
        await http
          .patch(api(`/properties/${propertyId}/rooms/${roomId}/status`))
          .set(staffAuth)
          .send({ status })
          .expect(200);
      }
      const locked = await http
        .patch(api(`/properties/${propertyId}/rooms/${roomId}/status`))
        .set(staffAuth)
        .send({ status: 'OUT_OF_ORDER' })
        .expect(403);
      expect(locked.body.errorCode).toBe('ROOM_LOCKED');
      const ooo = await http
        .patch(api(`/properties/${propertyId}/rooms/${roomId}/status`))
        .set(auth())
        .send({ status: 'OUT_OF_ORDER', memo: '에어컨 누수' })
        .expect(200);
      expect(ooo.body).toMatchObject({ status: 'OUT_OF_ORDER', memo: '에어컨 누수', changedBy: '정현' });
      // 직원은 판매 중지를 풀 수 없다
      await http
        .patch(api(`/properties/${propertyId}/rooms/${roomId}/status`))
        .set(staffAuth)
        .send({ status: 'READY' })
        .expect(403);
      const logs = await http
        .get(api(`/properties/${propertyId}/rooms/${roomId}/logs`))
        .set(auth())
        .expect(200);
      expect(logs.body.map((l: { to: string }) => l.to)).toEqual(['OUT_OF_ORDER', 'INSPECT', 'CLEANING', 'DIRTY']);
      expect(logs.body[1].by).toBe('김민지');
      // 다른 업장 객실은 404
      await http
        .patch(api(`/properties/${propertyId}/rooms/00000000-0000-4000-8000-000000000000/status`))
        .set(auth())
        .send({ status: 'READY' })
        .expect(404);
    });

    it('인수인계는 누구나, 공지는 사장님·매니저만 · 확인 표시', async () => {
      const h = await http
        .post(api(`/properties/${propertyId}/ops-notes`))
        .set(staffAuth)
        .send({ kind: 'HANDOVER', shift: 'DAY', body: '305호 수건 추가 요청 있었어요.' })
        .expect(201);
      expect(h.body).toMatchObject({ author: '김민지', readByMe: true, shift: 'DAY' });
      await http
        .post(api(`/properties/${propertyId}/ops-notes`))
        .set(staffAuth)
        .send({ kind: 'NOTICE', body: '공지' })
        .expect(403);
      const n = await http
        .post(api(`/properties/${propertyId}/ops-notes`))
        .set(auth())
        .send({ kind: 'NOTICE', body: '이번 주 소독 방역 — 목요일 오전', pinned: true })
        .expect(201);
      let b = await http
        .get(api(`/properties/${propertyId}/ops`))
        .set(staffAuth)
        .expect(200);
      expect(b.body.unread).toBe(1);
      expect(b.body.notices[0]).toMatchObject({ pinned: true, readByMe: false });
      await http
        .post(api(`/properties/${propertyId}/ops-notes/${n.body.id}/read`))
        .set(staffAuth)
        .expect(204);
      b = await http
        .get(api(`/properties/${propertyId}/ops`))
        .set(auth())
        .expect(200);
      expect(b.body.notices[0].readers.map((r: { name: string }) => r.name)).toEqual(['정현', '김민지']);
      expect(b.body.handovers[0].readByMe).toBe(false);
      // 남의 인수인계는 직원이 지울 수 없고, 사장님은 지울 수 있다
      await http
        .delete(api(`/properties/${propertyId}/ops-notes/${n.body.id}`))
        .set(staffAuth)
        .expect(403);
      await http
        .delete(api(`/properties/${propertyId}/ops-notes/${h.body.id}`))
        .set(auth())
        .expect(204);
    });
  });

  describe('구독 · 결제 · 알림 설정 (F0-08, F0-09, F0-13)', () => {
    it('업장 등록하면 리뷰·매출장부 30일 무료 체험', async () => {
      const b = await http
        .get(api(`/properties/${propertyId}/billing`))
        .set(auth())
        .expect(200);
      expect(b.body.subscribed.sort()).toEqual(['LEDGER', 'REVIEW']);
      expect(b.body.inTrial).toBe(true);
      expect(b.body.trialEnds).toBe(addDaysIso(kstDate(), 30));
      expect(b.body.nextBilling).toBe(b.body.trialEnds);
      expect(b.body.monthlyTotal).toBe(29_000 + 39_000);
    });

    it('체험 중에는 서비스를 켜도 결제하지 않는다, 준비 중 상품은 불가', async () => {
      const b = await http
        .put(api(`/properties/${propertyId}/subscriptions/STAFF`))
        .set(auth())
        .send({ enabled: true })
        .expect(200);
      expect(b.body.subscribed).toContain('STAFF');
      expect(b.body.payments).toHaveLength(0);
      await http
        .put(api(`/properties/${propertyId}/subscriptions/FINANCE`))
        .set(auth())
        .send({ enabled: true })
        .expect(400);
    });

    it('체험이 끝나면 정기결제 — 카드 없거나 실패하면 결제 실패 + 알림, 새 카드로 바로 재결제', async () => {
      const billing = app.get(BillingService);
      const pg = app.get(FakePaymentGateway);
      const after = addDaysIso(kstDate(), 30);
      await billing.billProperty(propertyId, after);
      let b = await http.get(api(`/properties/${propertyId}/billing`)).set(auth());
      expect(b.body.subscriptions.every((s: { status: string }) => s.status === 'PAST_DUE')).toBe(true);
      const n = await http.get(api(`/notifications?propertyId=${propertyId}`)).set(auth());
      expect(n.body.items[0].text).toContain('결제에 실패');

      await http
        .post(api(`/properties/${propertyId}/payment-method`))
        .set(auth())
        .send({ authKey: 'fail' })
        .expect(400);
      const before = pg.charges.length;
      b = await http
        .post(api(`/properties/${propertyId}/payment-method`))
        .set(auth())
        .send({ authKey: 'test-auth' })
        .expect(200);
      expect(b.body.card).toEqual({ name: '우주카드', last4: '4242' });
      expect(pg.charges.length).toBe(before + 1);
      expect(pg.charges.at(-1)?.amount).toBe(29_000 + 39_000 + 19_000);
      expect(b.body.subscriptions.every((s: { status: string }) => s.status === 'ACTIVE')).toBe(true);
      // 결제일에 한 번 결제하고, 같은 달에는 다시 결제하지 않는다
      expect(await billing.billProperty(propertyId, after)).toEqual({ amount: 87_000, ok: true });
      expect(await billing.billProperty(propertyId, after)).toBeNull();
    });

    it('알림 받기 설정', async () => {
      const d = await http
        .get(api(`/properties/${propertyId}/notification-settings`))
        .set(auth())
        .expect(200);
      expect(d.body).toHaveLength(6);
      const u = await http
        .put(api(`/properties/${propertyId}/notification-settings`))
        .set(auth())
        .send({ items: [{ kind: 'REVIEW', alimtalk: false, push: true, email: true }] })
        .expect(200);
      expect(u.body.find((x: { kind: string }) => x.kind === 'REVIEW')).toEqual({
        kind: 'REVIEW',
        alimtalk: false,
        push: true,
        email: true,
      });
    });
  });
});
