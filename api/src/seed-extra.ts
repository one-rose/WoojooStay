/**
 * 개발용 예시 데이터 (추가분) — 모든 화면에 "실제로 쓰는 것 같은" 데이터가 보이게 한다.
 * seed.ts 가 기본 업장(스테이 오르빗 을지로)을 만든 뒤 호출한다.
 *
 * - 기본 업장: 매니저 계정 · 대기 중 초대 · 지난 두 달 근무 기록과 급여(보냄 / 확정 전) · 등록 대기 영수증 ·
 *   광고비 직접 입력 · 답글 단 리뷰 · 연동 끊긴 채널 1곳 · 객실 상태 이력 · 알림
 * - 대전 실증 업장 5곳 (사업소개서 실증 계획): 한소영 대표 계정이 두 곳을 운영, 나머지는 각자 계정.
 *   채널 수 · 연동 상태 · 구독 · 결제 내역을 서로 다르게 둬서 운영자 화면도 확인할 수 있게.
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
  await seedPilotHotels(app, prisma);
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

/* ── 대전 실증 업장 5곳 ─────────────────────────────────────────── */

interface PilotHotel {
  name: string;
  address: string;
  rooms: number;
  prefix: string;
  channels: Channel[];
  /** 연동 상태를 다르게 — 운영자 화면 '연동 오류' 확인용 */
  broken?: { channel: Channel; status: 'AUTH_EXPIRED' | 'ERROR'; error: string };
  /** 체험이 끝나 유료로 쓰는 중 (결제 내역 3달) */
  paying?: boolean;
  staff: { name: string; phone: string; jobRole: 'FRONT' | 'NIGHT' | 'HOUSEKEEPING' | 'MANAGER'; pay: number }[];
}

const PILOTS: { owner: { name: string; phone: string }; hotels: PilotHotel[] }[] = [
  {
    owner: { name: '한소영', phone: '01020000000' },
    hotels: [
      {
        name: 'RAINBOW HOTEL',
        address: '대전 서구 둔산동 OO로 21',
        rooms: 48,
        prefix: '305810210',
        channels: ['YANOLJA', 'YEOGI', 'NAVER', 'AGODA'],
        paying: true,
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
        channels: ['YANOLJA', 'YEOGI', 'NAVER', 'AGODA'],
        staff: [
          { name: '하준영', phone: '01020002001', jobRole: 'FRONT', pay: 11_000 },
          { name: '서다인', phone: '01020002002', jobRole: 'HOUSEKEEPING', pay: 10_320 },
        ],
      },
    ],
  },
  {
    owner: { name: '김루오', phone: '01030000000' },
    hotels: [
      {
        name: '루오 호텔 대흥점',
        address: '대전 중구 대흥동 OO로 5',
        rooms: 35,
        prefix: '306830230',
        channels: ['YANOLJA', 'YEOGI', 'NAVER'],
        broken: { channel: 'YEOGI', status: 'AUTH_EXPIRED', error: '2차 인증이 필요해요.' },
        staff: [{ name: '장민서', phone: '01030001001', jobRole: 'FRONT', pay: 10_500 }],
      },
    ],
  },
  {
    owner: { name: '박도트', phone: '01040000000' },
    hotels: [
      {
        name: '브라운도트 호텔 대덕점',
        address: '대전 대덕구 오정동 OO로 40',
        rooms: 40,
        prefix: '317840240',
        channels: ['YANOLJA', 'AGODA'],
        broken: { channel: 'AGODA', status: 'ERROR', error: '파트너센터 응답이 없어요 (3회 연속).' },
        staff: [],
      },
    ],
  },
  {
    owner: { name: '노세븐', phone: '01050000000' },
    // 가입만 하고 채널은 아직 — 온보딩 미완료 업장
    hotels: [
      {
        name: 'N7 호텔',
        address: '대전 동구 정동 OO길 7',
        rooms: 28,
        prefix: '307850250',
        channels: [],
        staff: [],
      },
    ],
  },
];

async function seedPilotHotels(app: INestApplicationContext, prisma: PrismaService) {
  const properties = app.get(PropertiesService);
  const channels = app.get(ChannelsService);
  const billing = app.get(BillingService);
  const today = kstDate();
  const admin = await prisma.adminUser.findUnique({ where: { email: 'admin@woojoo.kr' } });

  for (const group of PILOTS) {
    const owner = await account(prisma, group.owner.phone, group.owner.name);
    for (const h of group.hotels) {
      const p = await properties.create(owner.id, {
        name: h.name,
        type: 'HOTEL',
        address: h.address,
        rooms: h.rooms,
        bizNo: bizNo(h.prefix),
        ownerName: group.owner.name,
      });
      if (admin) await prisma.property.update({ where: { id: p.id }, data: { managerId: admin.id } });
      for (const ch of h.channels) {
        await channels.connect(p.id, ch, { loginId: `pilot-${h.prefix}`, password: 'sample', consent: true });
        await channels.sync(p.id, ch, 120);
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

      // 객실 — 층마다 고르게
      const perFloor = Math.ceil(h.rooms / 6);
      const statuses = ['READY', 'OCCUPIED', 'OCCUPIED', 'DIRTY', 'READY', 'CLEANING', 'INSPECT'] as const;
      await prisma.room.createMany({
        data: Array.from({ length: h.rooms }, (_, i) => {
          const floor = Math.floor(i / perFloor) + 2;
          const n = (i % perFloor) + 1;
          return {
            propertyId: p.id,
            number: `${floor}${String(n).padStart(2, '0')}`,
            floor,
            roomType: n % 3 === 0 ? '트윈' : '더블',
            sortOrder: i,
            status: statuses[(i * 5 + floor) % statuses.length],
          };
        }),
      });

      // 직원 · 이번 달 근무 기록
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
        for (let d = `${today.slice(0, 7)}-01`; d < today; d = addDaysIso(d, 1)) {
          if ((dateOnly(d).getUTCDay() + i) % 7 < 2) continue;
          const night = s.jobRole === 'NIGHT';
          await prisma.attendance.create({
            data: {
              employeeId: e.id,
              workDate: dateOnly(d),
              clockInAt: night ? kst(d, '22:00') : kst(d, '09:00'),
              clockOutAt: night ? kst(addDaysIso(d, 1), '07:00') : kst(d, '16:00'),
            },
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

      // 유료 업장 — 체험이 끝나 지난 석 달 결제
      if (h.paying) {
        await billing.setCard(p.id, `seed-card-${h.prefix}`);
        const subs = await prisma.subscription.findMany({ where: { propertyId: p.id }, include: { plan: true } });
        const total = subs.reduce((sum, s) => sum + s.plan.monthlyPrice, 0);
        for (const back of [3, 2, 1, 0]) {
          const m = addMonths(today.slice(0, 7), -back);
          if (back === 0 && Number(today.slice(8)) < 5) continue;
          await prisma.payment.create({
            data: {
              propertyId: p.id,
              billedMonth: monthStart(m),
              description: `${Number(m.slice(5))}월 구독 (${subs.map((s) => s.plan.name).join(', ')})`,
              amount: total,
              status: back === 2 ? 'FAILED' : 'PAID',
              orderNo: `wj-seed-${h.prefix}-${m}`,
              paidAt: kst(`${m}-05`, '09:00'),
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
        await prisma.subscription.updateMany({
          where: { propertyId: p.id },
          data: {
            status: 'ACTIVE',
            trialEndsAt: dateOnly(addDaysIso(today, -100)),
            paidMonth: monthStart(Number(today.slice(8)) < 5 ? addMonths(today.slice(0, 7), -1) : today.slice(0, 7)),
          },
        });
      }
    }
  }
}
