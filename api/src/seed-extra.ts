/**
 * 개발용 예시 데이터 (추가분) — 모든 화면에 "실제로 쓰는 것 같은" 데이터가 보이게 한다.
 * seed.ts 가 기본 업장(스테이 오르빗 을지로)을 만든 뒤 호출한다.
 *
 * - 기본 업장: 매니저 계정 · 대기 중 초대 · 지난 두 달 근무 기록과 급여(보냄 / 확정 전) · 등록 대기 영수증 ·
 *   광고비 직접 입력 · 답글 단 리뷰 · 연동 끊긴 채널 1곳 · 객실 상태 이력 · 알림
 * - 한소영 대표 업장 10곳 (실증 5곳 + 대전·충청 5곳) — 여러 업장 통합 현황(/app/overview) 확인용.
 *   매출 크기 · 채널 수 · 연동 상태 · 미답변 · 객실 청소 지연 · 근무 · 구독·결제를 업장마다 다르게.
 *   예전 실증 업장 대표 계정(루오·브라운도트·N7)은 그 업장의 매니저로 남아 로그인하면 업장 하나만 보인다.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { INestApplicationContext } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { BillingService } from './billing/billing.service.js';
import { ChannelsService } from './channels/channels.service.js';
import { isValidBizNo } from './common/utils/biz-no.js';
import { sha256 } from './common/utils/crypto.js';
import { addDaysIso, addMonths, dateOnly, kstDate, monthStart } from './common/utils/dates.js';
import type { Channel } from './generated/prisma/enums.js';
import { NotificationsService } from './notifications/notifications.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { PropertiesService } from './properties/properties.service.js';
import { ReviewsService } from './reviews/reviews.service.js';
import { StaffService } from './staff/staff.service.js';

const PASSWORD = 'woojoo1234';
const kst = (d: string, t: string) => new Date(`${d}T${t}:00+09:00`);

/** 검증번호가 맞는 사업자등록번호 */
function bizNo(prefix: string): string {
  for (let d = 0; d <= 9; d++) if (isValidBizNo(prefix + d)) return prefix + d;
  throw new Error(`사업자번호를 만들 수 없어요: ${prefix}`);
}

async function account(prisma: PrismaService, phone: string, name: string) {
  const found = await prisma.user.findUnique({ where: { phone } });
  if (found) return found;
  const now = new Date();
  return prisma.user.create({
    data: {
      phone,
      name,
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      termsAgreedAt: now,
      privacyAgreedAt: now,
    },
  });
}

export async function seedExtra(app: INestApplicationContext, demo: { propertyId: string; ownerId: string }) {
  const prisma = app.get(PrismaService);
  await enrichDemo(app, prisma, demo);
  await seedPortfolio(app, prisma, PORTFOLIO_OWNER, PORTFOLIO);
  await seedOrbitChain(app);
}

/**
 * 기본 계정(정현 · 스테이 오르빗 을지로)에도 업장 9곳을 더 붙여 모두 10곳 — 그 계정으로도 전체 현황을 본다.
 * 이미 업장이 2곳 이상이면 건너뛴다 (seed-portfolio.ts 로 따로 실행해도 안전).
 */
export async function seedOrbitChain(app: INestApplicationContext): Promise<number> {
  const prisma = app.get(PrismaService);
  const owner = await prisma.user.findUnique({ where: { phone: ORBIT_OWNER.phone } });
  if (!owner) throw new Error('기본 계정(010-0000-0000)이 없어요. 먼저 pnpm db:seed 를 실행해 주세요.');
  const count = await prisma.membership.count({ where: { userId: owner.id, role: { in: ['OWNER', 'MANAGER'] } } });
  if (count > 1) return 0;
  await seedPortfolio(app, prisma, { name: owner.name, phone: owner.phone }, ORBIT_CHAIN);
  return ORBIT_CHAIN.length;
}

/* ── 기본 업장 채우기 ─────────────────────────────────────────── */

async function enrichDemo(
  app: INestApplicationContext,
  prisma: PrismaService,
  demo: { propertyId: string; ownerId: string },
) {
  const { propertyId, ownerId } = demo;
  const today = kstDate();
  const month = today.slice(0, 7);

  // 매니저 계정 (최도윤) — 직원 명단과 연결
  const manager = await account(prisma, '01044445555', '최도윤');
  await prisma.membership.upsert({
    where: { userId_propertyId: { userId: manager.id, propertyId } },
    create: { userId: manager.id, propertyId, role: 'MANAGER' },
    update: {},
  });
  await prisma.employee.updateMany({ where: { propertyId, phone: '01044445555' }, data: { userId: manager.id } });

  // 대기 중인 직원 초대 (설정 > 직원 계정·권한)
  await prisma.invitation.create({
    data: {
      propertyId,
      phone: '01066667777',
      role: 'STAFF',
      tokenHash: sha256(`seed-invite-${randomUUID()}`),
      invitedById: ownerId,
      expiresAt: new Date(Date.now() + 5 * 86_400_000),
    },
  });

  // 최저시급 미달 경고 확인용 직원(정유나)은 이번 달 입사로 — 지난달 급여 확정을 막지 않게
  await prisma.employee.updateMany({
    where: { propertyId, phone: '01055556666' },
    data: { hiredDate: monthStart(month) },
  });

  // 지난 두 달 근무 기록 — 급여 화면용
  const staff = await prisma.employee.findMany({
    where: { propertyId, resignedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  for (const back of [2, 1]) {
    const m = addMonths(month, -back);
    const last = addDaysIso(`${addMonths(m, 1)}-01`, -1);
    for (const [i, e] of staff.entries()) {
      if (e.hiredDate > dateOnly(last) || e.payType === 'MONTHLY') continue;
      const night = e.jobRole === 'NIGHT';
      for (let d = `${m}-01`; d <= last; d = addDaysIso(d, 1)) {
        if (dateOnly(d) < e.hiredDate) continue;
        const off = (dateOnly(d).getUTCDay() + i) % 7 < 2;
        await prisma.workShift.upsert({
          where: { employeeId_workDate: { employeeId: e.id, workDate: dateOnly(d) } },
          create: { employeeId: e.id, workDate: dateOnly(d), shiftType: off ? 'OFF' : night ? 'NIGHT' : 'DAY' },
          update: {},
        });
        if (off) continue;
        // 가끔 5~15분 늦게 출근, 한 달에 한 번은 1시간 연장
        const late =
          (i * 7 + Number(d.slice(8))) % 11 === 0 ? `09:${String(5 + (i % 3) * 5).padStart(2, '0')}` : '09:00';
        const extra = Number(d.slice(8)) === 15 ? '17:00' : '16:00';
        await prisma.attendance.create({
          data: {
            employeeId: e.id,
            workDate: dateOnly(d),
            clockInAt: night ? kst(d, '22:00') : kst(d, late),
            clockOutAt: night ? kst(addDaysIso(d, 1), '07:00') : kst(d, extra),
          },
        });
      }
    }
  }
  const staffService = app.get(StaffService);
  const twoAgo = addMonths(month, -2);
  const oneAgo = addMonths(month, -1);
  await staffService.calculatePayroll(propertyId, twoAgo);
  await staffService
    .confirmPayroll(propertyId, twoAgo)
    .catch((e: Error) => console.warn(`급여 확정 건너뜀: ${e.message}`));
  await staffService
    .sendPayroll(propertyId, twoAgo)
    .catch((e: Error) => console.warn(`급여 발송 건너뜀: ${e.message}`));
  await staffService.calculatePayroll(propertyId, oneAgo); // 지난달은 확정 전

  // 광고비 직접 입력 (이번 달)
  for (const [channel, amount] of [
    ['YANOLJA', 1_850_000],
    ['YEOGI', 1_320_000],
  ] as const) {
    await prisma.adSpend.upsert({
      where: { propertyId_channel_month: { propertyId, channel, month: monthStart(month) } },
      create: { propertyId, channel, month: monthStart(month), amount, source: 'MANUAL' },
      update: { amount, source: 'MANUAL' },
    });
  }

  // 등록 대기 영수증 2장 (지출관리 > 영수증 등록)
  const uploadDir = resolve(process.env.UPLOAD_DIR ?? './uploads');
  const dir = join(uploadDir, 'receipts', propertyId);
  await mkdir(dir, { recursive: true });
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
    'base64',
  );
  for (const r of [
    { file: '조식식자재_영수증.png', vendor: '대전 새벽시장 식자재', amount: 184_500, category: 'FOOD' as const },
    { file: '세탁비_11월2주.png', vendor: null, amount: null, category: null },
  ]) {
    const name = `${randomUUID()}.png`;
    await writeFile(join(dir, name), png);
    await prisma.receipt.create({
      data: {
        propertyId,
        fileName: r.file,
        mimeType: 'image/png',
        sizeBytes: png.length,
        storagePath: join('receipts', propertyId, name),
        ocrVendor: r.vendor,
        ocrDate: r.vendor ? dateOnly(addDaysIso(today, -2)) : null,
        ocrAmount: r.amount,
        ocrCategory: r.category,
        uploadedById: ownerId,
      },
    });
  }

  // 답글 단 리뷰 3건 (복사 게시 기록)
  const reviews = app.get(ReviewsService);
  const unanswered = await prisma.review.findMany({
    where: { propertyId, status: 'UNANSWERED', rating: { gte: 4 }, needsReview: false },
    include: { draft: true },
    orderBy: { postedAt: 'asc' },
    take: 3,
  });
  for (const r of unanswered) {
    const text = r.draft?.text ?? '소중한 후기 감사합니다. 다음에도 편히 쉬어 가실 수 있게 준비하겠습니다.';
    await reviews.post(propertyId, r.id, ownerId, text).catch(() => undefined);
  }

  // 연동이 끊긴 채널 1곳 — 홈 상단 경고 · 설정 > 채널 연동 "다시 로그인" 확인용
  await prisma.channelConnection.updateMany({
    where: { propertyId, channel: 'DDNAYO' },
    data: { status: 'AUTH_EXPIRED', consecutiveFails: 1, lastError: '비밀번호가 바뀌어 로그인할 수 없어요.' },
  });

  // 객실 상태 이력 (객실 칸을 눌렀을 때 "최근 기록")
  const rooms = await prisma.room.findMany({ where: { propertyId }, orderBy: { sortOrder: 'asc' }, take: 12 });
  const housekeeper = await prisma.user.findUnique({ where: { phone: '01011112222' } });
  for (const [i, room] of rooms.entries()) {
    const steps = ['OCCUPIED', 'DIRTY', 'CLEANING', 'INSPECT', 'READY'] as const;
    let at = Date.now() - (26 + i) * 3_600_000;
    for (let s = 1; s < steps.length; s++) {
      at += (35 + ((i * 13 + s * 7) % 50)) * 60_000;
      await prisma.roomStatusLog.create({
        data: {
          roomId: room.id,
          fromStatus: steps[s - 1],
          toStatus: steps[s],
          changedById: s === 4 ? manager.id : (housekeeper?.id ?? ownerId),
          changedAt: new Date(at),
        },
      });
    }
  }

  // 앱 안 알림 몇 건 (종 아이콘)
  const notifications = app.get(NotificationsService);
  await notifications.notifyProperty(
    propertyId,
    'SYNC',
    '떠나요 연동이 끊겼어요. 다시 로그인해 주세요.',
    '/app/settings/channels',
  );
  await notifications.notifyProperty(
    propertyId,
    'STAFF',
    `${Number(oneAgo.slice(5))}월 급여 계산이 끝났어요. 근무 기록을 확인하고 확정해 주세요.`,
    '/app/staff',
  );
  await notifications.notifyProperty(
    propertyId,
    'BILLING',
    '무료 체험이 끝나기 전에 결제 카드를 확인해 주세요.',
    '/app/settings/billing',
  );
}

/* ── 한소영 대표 업장 10곳 (실증 5곳 + 대전·충청 5곳) ─────────────────── */

type StaffSeed = { name: string; phone: string; jobRole: 'FRONT' | 'NIGHT' | 'HOUSEKEEPING' | 'MANAGER'; pay: number };

interface PilotHotel {
  name: string;
  type?: 'HOTEL' | 'MOTEL' | 'PENSION' | 'GUESTHOUSE';
  address: string;
  rooms: number;
  prefix: string;
  channels: Channel[];
  /** 매출 크기 — 예시 연결은 채널마다 같은 금액이라 업장마다 곱해서 다르게 */
  scale: number;
  /** 연동 상태를 다르게 — 통합 현황 · 운영자 화면 '연동 오류' 확인용 */
  broken?: { channel: Channel; status: 'AUTH_EXPIRED' | 'ERROR'; error: string };
  /** 체험이 끝나 유료로 쓰는 중 (결제 내역 3달) */
  paying?: boolean;
  /** 유료인데 이번 달 결제가 실패 (PAST_DUE) */
  pastDue?: boolean;
  /** 답글을 단 리뷰 비율 (0~1, 낮은 별점은 1일 때만 모두) */
  answered: number;
  /** 청소 필요로 2시간 넘게 머문 객실 수 */
  staleDirty?: number;
  /** 지금 근무 중인 직원 수 (앞에서부터) · 퇴근 기록이 빠진 근무 수 */
  onDuty?: number;
  missingOut?: number;
  /** 예전 대표 계정 — 이 업장의 매니저로 남겨 그 계정 로그인도 그대로 */
  manager?: { name: string; phone: string };
  staff: StaffSeed[];
}

const PORTFOLIO_OWNER = { name: '한소영', phone: '01020000000' };

const PORTFOLIO: PilotHotel[] = [
  {
    name: 'RAINBOW HOTEL',
    address: '대전 서구 둔산동 OO로 21',
    rooms: 48,
    prefix: '305810210',
    channels: ['YANOLJA', 'YEOGI', 'NAVER', 'AGODA'],
    scale: 1,
    paying: true,
    answered: 0.3,
    staleDirty: 4,
    onDuty: 2,
    missingOut: 1,
    staff: [
      { name: '오세린', phone: '01020001001', jobRole: 'FRONT', pay: 10_800 },
      { name: '문태호', phone: '01020001002', jobRole: 'NIGHT', pay: 11_500 },
      { name: '배은지', phone: '01020001003', jobRole: 'HOUSEKEEPING', pay: 10_500 },
    ],
  },
  {
    name: '저스트슬립호텔 대전유성온천점',
    address: '대전 유성구 봉명동 OO길 8',
    rooms: 62,
    prefix: '314820220',
    channels: ['YANOLJA', 'YEOGI', 'NAVER', 'AGODA', 'TRIP'],
    scale: 1.32,
    paying: true,
    pastDue: true,
    answered: 0.6,
    onDuty: 2,
    staff: [
      { name: '하준영', phone: '01020002001', jobRole: 'FRONT', pay: 11_000 },
      { name: '서다인', phone: '01020002002', jobRole: 'HOUSEKEEPING', pay: 10_320 },
    ],
  },
  {
    name: '루오 호텔 대흥점',
    address: '대전 중구 대흥동 OO로 5',
    rooms: 35,
    prefix: '306830230',
    channels: ['YANOLJA', 'YEOGI', 'NAVER'],
    scale: 0.72,
    broken: { channel: 'YEOGI', status: 'AUTH_EXPIRED', error: '2차 인증이 필요해요.' },
    answered: 0.5,
    onDuty: 1,
    manager: { name: '김루오', phone: '01030000000' },
    staff: [{ name: '장민서', phone: '01030001001', jobRole: 'FRONT', pay: 10_500 }],
  },
  {
    name: '브라운도트 호텔 대덕점',
    address: '대전 대덕구 오정동 OO로 40',
    rooms: 40,
    prefix: '317840240',
    channels: ['YANOLJA', 'AGODA'],
    scale: 0.81,
    broken: { channel: 'AGODA', status: 'ERROR', error: '파트너센터 응답이 없어요 (3회 연속).' },
    answered: 0,
    staleDirty: 2,
    manager: { name: '박도트', phone: '01040000000' },
    staff: [],
  },
  {
    // 가입만 하고 채널은 아직 — 온보딩 미완료 업장
    name: 'N7 호텔',
    address: '대전 동구 정동 OO길 7',
    rooms: 28,
    prefix: '307850250',
    channels: [],
    scale: 0,
    answered: 1,
    manager: { name: '노세븐', phone: '01050000000' },
    staff: [],
  },
  {
    name: '호텔 온새미 천안',
    address: '충남 천안시 서북구 불당동 OO로 18',
    rooms: 54,
    prefix: '312860260',
    channels: ['YANOLJA', 'YEOGI', 'NAVER', 'AGODA', 'TRIP'],
    scale: 1.14,
    paying: true,
    answered: 1,
    onDuty: 2,
    staff: [
      { name: '윤가람', phone: '01020006001', jobRole: 'FRONT', pay: 11_200 },
      { name: '임채운', phone: '01020006002', jobRole: 'HOUSEKEEPING', pay: 10_500 },
      { name: '조하율', phone: '01020006003', jobRole: 'NIGHT', pay: 11_800 },
    ],
  },
  {
    name: '스테이 한밭 둔산',
    type: 'MOTEL',
    address: '대전 서구 탄방동 OO길 33',
    rooms: 30,
    prefix: '305870270',
    channels: ['YANOLJA', 'YEOGI', 'KKUL'],
    scale: 0.58,
    answered: 0.7,
    staleDirty: 9,
    onDuty: 1,
    staff: [{ name: '권도하', phone: '01020007001', jobRole: 'HOUSEKEEPING', pay: 10_320 }],
  },
  {
    name: '청주 무심천 호텔',
    address: '충북 청주시 상당구 남주동 OO로 9',
    rooms: 44,
    prefix: '301880280',
    channels: ['YANOLJA', 'NAVER', 'AGODA', 'HOTELS'],
    scale: 0.93,
    answered: 0.85,
    missingOut: 2,
    onDuty: 1,
    staff: [
      { name: '남궁별', phone: '01020008001', jobRole: 'FRONT', pay: 10_800 },
      { name: '표지안', phone: '01020008002', jobRole: 'NIGHT', pay: 11_500 },
    ],
  },
  {
    name: '세종 호수공원 스테이',
    type: 'GUESTHOUSE',
    address: '세종 연기면 OO로 55',
    rooms: 24,
    prefix: '320890290',
    channels: ['NAVER', 'YEOGI', 'DDNAYO'],
    scale: 0.46,
    answered: 0.8,
    staff: [{ name: '선우린', phone: '01020009001', jobRole: 'FRONT', pay: 10_320 }],
  },
  {
    name: '공주 금강 한옥펜션',
    type: 'PENSION',
    address: '충남 공주시 웅진동 OO길 4',
    rooms: 12,
    prefix: '307900300',
    channels: ['NAVER', 'DDNAYO', 'YEOGI'],
    scale: 0.27,
    answered: 1,
    staff: [],
  },
];

const ORBIT_OWNER = { phone: '01000000000' };

/** 정현 계정의 추가 9곳 — 한소영 대표 업장과 같은 문제 구성(연동 끊김 · 결제 실패 · 청소 지연 · 퇴근 누락 · 채널 없음)을 서울 지점 이름으로 */
const ORBIT_NAMES: { name: string; address: string; type?: PilotHotel['type'] }[] = [
  { name: '스테이 오르빗 명동', address: '서울 중구 명동 OO길 3' },
  { name: '스테이 오르빗 종로', address: '서울 종로구 관철동 OO로 14' },
  { name: '스테이 오르빗 성수', address: '서울 성동구 성수동 OO길 27' },
  { name: '스테이 오르빗 강남역', address: '서울 강남구 역삼동 OO로 8' },
  { name: '스테이 오르빗 홍대', address: '서울 마포구 서교동 OO길 19' },
  { name: '오르빗 모텔 신림', address: '서울 관악구 신림동 OO로 41', type: 'MOTEL' },
  { name: '스테이 오르빗 여의도', address: '서울 영등포구 여의도동 OO로 2' },
  { name: '오르빗 게스트하우스 이태원', address: '서울 용산구 이태원동 OO길 6', type: 'GUESTHOUSE' },
  { name: '오르빗 한옥스테이 북촌', address: '서울 종로구 가회동 OO길 11', type: 'PENSION' },
];

const ORBIT_CHAIN: PilotHotel[] = PORTFOLIO.slice(1).map((h, i) => ({
  ...h,
  ...ORBIT_NAMES[i],
  prefix: `1048${String(i + 1).padStart(2, '0')}${h.prefix.slice(6)}`,
  manager: undefined,
  staff: h.staff.map((s, k) => ({
    ...s,
    phone: `0106${String(i + 1).padStart(2, '0')}0${String(k + 1).padStart(2, '0')}0`,
  })),
}));

/** 실증 업장 매출 수집 기간 — 이번 달 · 지난달 비교와 정산 달력이 보이도록 */
const PILOT_SYNC_DAYS = 100;

async function seedPortfolio(
  app: INestApplicationContext,
  prisma: PrismaService,
  ownerSpec: { name: string; phone: string },
  list: PilotHotel[],
) {
  const properties = app.get(PropertiesService);
  const channels = app.get(ChannelsService);
  const billing = app.get(BillingService);
  const today = kstDate();
  const now = Date.now();
  const admin = await prisma.adminUser.findUnique({ where: { email: 'admin@woojoo.kr' } });
  const owner = await account(prisma, ownerSpec.phone, ownerSpec.name);

  for (const h of list) {
    const p = await properties.create(owner.id, {
      name: h.name,
      type: h.type ?? 'HOTEL',
      address: h.address,
      rooms: h.rooms,
      bizNo: bizNo(h.prefix),
      ownerName: ownerSpec.name,
    });
    if (admin) await prisma.property.update({ where: { id: p.id }, data: { managerId: admin.id } });
    if (h.manager) {
      const m = await account(prisma, h.manager.phone, h.manager.name);
      await prisma.membership.create({ data: { userId: m.id, propertyId: p.id, role: 'MANAGER' } });
    }
    for (const ch of h.channels) {
      await channels.connect(p.id, ch, { loginId: `pilot-${h.prefix}`, password: 'sample', consent: true });
      await channels.sync(p.id, ch, PILOT_SYNC_DAYS);
    }
    if (h.channels.length && h.scale !== 1) {
      // 예시 연결은 채널마다 같은 금액 — 업장 크기에 맞게 매출·정산을 키우거나 줄인다
      await prisma.$executeRaw`UPDATE wj_booking SET sale_amount = (ROUND(sale_amount * ${h.scale}::numeric / 1000) * 1000)::int,
        commission_amount = ROUND(commission_amount * ${h.scale}::numeric)::int WHERE property_id = ${p.id}::uuid`;
      await prisma.$executeRaw`UPDATE wj_settlement SET settle_amount = (ROUND(settle_amount * ${h.scale}::numeric / 1000) * 1000)::int
        WHERE property_id = ${p.id}::uuid`;
    }
    if (h.broken) {
      await prisma.channelConnection.updateMany({
        where: { propertyId: p.id, channel: h.broken.channel },
        data: {
          status: h.broken.status,
          lastError: h.broken.error,
          consecutiveFails: h.broken.status === 'ERROR' ? 3 : 1,
        },
      });
    }

    // 답글 — 업장마다 비율을 다르게 (1이면 모두, 아니면 별점 높은 것부터)
    if (h.answered > 0) {
      const open = await prisma.review.findMany({
        where: { propertyId: p.id, status: 'UNANSWERED' },
        orderBy: [{ rating: 'desc' }, { postedAt: 'asc' }],
        select: { id: true, rating: true },
      });
      const take = h.answered >= 1 ? open : open.slice(0, Math.round(open.length * h.answered));
      const done = take.filter((r) => h.answered >= 1 || r.rating > 3);
      if (done.length) {
        await prisma.reply.createMany({
          data: done.map((r) => ({
            reviewId: r.id,
            text: '소중한 후기 감사합니다. 다음에도 편히 쉬어 가실 수 있게 준비하겠습니다.',
            via: 'COPY' as const,
            postedById: owner.id,
          })),
        });
        await prisma.review.updateMany({ where: { id: { in: done.map((r) => r.id) } }, data: { status: 'POSTED' } });
      }
    }

    // 객실 — 층마다 고르게. 앞의 staleDirty 실은 청소 필요로 3시간째
    const perFloor = Math.ceil(h.rooms / 6);
    const statuses = ['READY', 'OCCUPIED', 'OCCUPIED', 'READY', 'CLEANING', 'OCCUPIED', 'INSPECT', 'DIRTY'] as const;
    const stale = h.staleDirty ?? 0;
    await prisma.room.createMany({
      data: Array.from({ length: h.rooms }, (_, i) => {
        const floor = Math.floor(i / perFloor) + 2;
        const num = (i % perFloor) + 1;
        const status =
          i < stale
            ? 'DIRTY'
            : i === h.rooms - 1 && h.rooms > 30
              ? 'OUT_OF_ORDER'
              : statuses[(i * 5 + floor) % statuses.length];
        return {
          propertyId: p.id,
          number: `${floor}${String(num).padStart(2, '0')}`,
          floor,
          roomType: num % 3 === 0 ? '트윈' : '더블',
          sortOrder: i,
          status,
          statusChangedAt: new Date(now - (i < stale ? 3 * 3_600_000 + i * 600_000 : (i % 5) * 1_200_000)),
        };
      }),
    });

    // 직원 · 이번 달 근무 기록 · 지금 근무 중 · 퇴근 누락
    for (const [i, s] of h.staff.entries()) {
      const e = await prisma.employee.create({
        data: {
          propertyId: p.id,
          name: s.name,
          phone: s.phone,
          jobRole: s.jobRole,
          payType: 'HOURLY',
          payAmount: s.pay,
          hiredDate: dateOnly(addDaysIso(today, -120 + i * 20)),
        },
      });
      const missingDays = new Set(
        i === 0 && h.missingOut ? Array.from({ length: h.missingOut }, (_, k) => addDaysIso(today, -2 - k * 2)) : [],
      );
      for (let d = addDaysIso(today, -20); d < today; d = addDaysIso(d, 1)) {
        if (!missingDays.has(d) && (dateOnly(d).getUTCDay() + i) % 7 < 2) continue;
        const night = s.jobRole === 'NIGHT';
        await prisma.attendance.create({
          data: {
            employeeId: e.id,
            workDate: dateOnly(d),
            clockInAt: night ? kst(d, '22:00') : kst(d, '09:00'),
            clockOutAt: missingDays.has(d) ? null : night ? kst(addDaysIso(d, 1), '07:00') : kst(d, '16:00'),
          },
        });
      }
      if (i < (h.onDuty ?? 0)) {
        await prisma.attendance.create({
          data: { employeeId: e.id, workDate: dateOnly(today), clockInAt: new Date(now - (3 + i) * 3_600_000) },
        });
      }
    }

    // 공지 1건
    await prisma.opsNote.create({
      data: {
        propertyId: p.id,
        kind: 'NOTICE',
        isPinned: true,
        authorId: owner.id,
        body: '우주스테이 실증 기간(8주) 동안 리뷰 답글은 앱에서 초안을 확인하고 게시해 주세요.',
      },
    });

    // 유료 업장 — 체험이 끝나 지난 석 달 결제 (pastDue 면 이번 달 결제 실패)
    if (h.paying) {
      await billing.setCard(p.id, `seed-card-${h.prefix}`);
      const subs = await prisma.subscription.findMany({ where: { propertyId: p.id }, include: { plan: true } });
      const total = subs.reduce((sum, s) => sum + s.plan.monthlyPrice, 0);
      const thisMonth = today.slice(0, 7);
      for (const back of [3, 2, 1, 0]) {
        const m = addMonths(thisMonth, -back);
        if (back === 0 && !h.pastDue && Number(today.slice(8)) < 5) continue;
        const failed = back === 2 || (back === 0 && h.pastDue);
        await prisma.payment.create({
          data: {
            propertyId: p.id,
            billedMonth: monthStart(m),
            description: `${Number(m.slice(5))}월 구독 (${subs.map((s) => s.plan.name).join(', ')})`,
            amount: total,
            status: failed ? 'FAILED' : 'PAID',
            orderNo: `wj-seed-${h.prefix}-${m}`,
            paidAt: back === 0 && h.pastDue ? new Date(now - 86_400_000) : kst(`${m}-05`, '09:00'),
          },
        });
        if (back === 2) {
          await prisma.payment.create({
            data: {
              propertyId: p.id,
              billedMonth: monthStart(m),
              description: `${Number(m.slice(5))}월 구독 재결제`,
              amount: total,
              status: 'PAID',
              orderNo: `wj-seed-${h.prefix}-${m}-retry`,
              paidAt: kst(`${m}-06`, '09:00'),
            },
          });
        }
      }
      const paidThrough = h.pastDue || Number(today.slice(8)) < 5 ? addMonths(thisMonth, -1) : thisMonth;
      await prisma.subscription.updateMany({
        where: { propertyId: p.id },
        data: {
          status: h.pastDue ? 'PAST_DUE' : 'ACTIVE',
          trialEndsAt: dateOnly(addDaysIso(today, -100)),
          paidMonth: monthStart(paidThrough),
        },
      });
      if (h.pastDue) {
        await app
          .get(NotificationsService)
          .notifyProperty(
            p.id,
            'BILLING',
            '이번 달 구독 결제가 실패했어요. 결제 카드를 확인해 주세요.',
            '/app/settings/billing',
          );
      }
    }
  }
}
