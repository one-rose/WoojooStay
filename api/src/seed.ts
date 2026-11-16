/**
 * 개발용 예시 데이터 — 사장님 계정 + 업장 + 9개 채널 연결(예시 연결로 리뷰·매출·정산 300일 수집)
 * + 직원 5명·출퇴근·근무표, 지출·발주, 무료 체험 구독, 운영자 계정·도입 문의
 * 실행: pnpm build && pnpm db:seed          (이미 있으면 건너뜀)
 *       pnpm build && pnpm db:seed:reset    (데이터를 모두 지우고 다시 — 개발 DB 에서만)
 * 로그인: 010-0000-0000 / woojoo1234
 * 직원:   010-1111-2222 / woojoo1234 (출퇴근 화면)
 * 운영자: admin@woojoo.kr / Woojoo1234! (개발용 — 운영 서버에서는 pnpm admin:create 로 따로 만든다)
 */
import { NestFactory } from '@nestjs/core';
import bcrypt from 'bcryptjs';
import { createAdminUser } from './admin/admin-auth.service.js';
import { BillingService } from './billing/billing.service.js';
import { addDaysIso, addMonths, dateOnly, kstDate } from './common/utils/dates.js';
import { AppModule } from './app.module.js';
import { ChannelsService } from './channels/channels.service.js';
import { CHANNELS } from './connectors/catalog.js';
import { PrismaService } from './prisma/prisma.service.js';
import { PropertiesService } from './properties/properties.service.js';
import { seedExtra } from './seed-extra.js';

const PHONE = '01000000000';

/** 알바·지출·구독 예시 */
async function seedBusiness(prisma: PrismaService, propertyId: string, ownerId: string) {
  const today = kstDate();
  const month = today.slice(0, 7);
  const staff = [
    { name: '김민지', phone: '01011112222', jobRole: 'FRONT', payType: 'HOURLY', payAmount: 11_000, shift: 'DAY' },
    { name: '박서준', phone: '01022223333', jobRole: 'NIGHT', payType: 'HOURLY', payAmount: 12_000, shift: 'NIGHT' },
    {
      name: '이하늘',
      phone: '01033334444',
      jobRole: 'HOUSEKEEPING',
      payType: 'HOURLY',
      payAmount: 10_320,
      shift: 'DAY',
    },
    {
      name: '최도윤',
      phone: '01044445555',
      jobRole: 'MANAGER',
      payType: 'MONTHLY',
      payAmount: 2_600_000,
      shift: 'DAY',
    },
    {
      name: '정유나',
      phone: '01055556666',
      jobRole: 'HOUSEKEEPING',
      payType: 'HOURLY',
      payAmount: 10_000,
      shift: 'DAY',
    },
  ] as const;
  const kst = (d: string, t: string) => new Date(`${d}T${t}:00+09:00`);
  for (const [i, s] of staff.entries()) {
    // 첫 직원(김민지)은 앱 계정도 만든다 — 직원 출퇴근 화면(/app/me) 확인용
    const account =
      i === 0
        ? await prisma.user.create({
            data: {
              phone: s.phone,
              name: s.name,
              passwordHash: await bcrypt.hash('woojoo1234', 10),
              termsAgreedAt: new Date(),
              privacyAgreedAt: new Date(),
              memberships: { create: { propertyId, role: 'STAFF' } },
            },
          })
        : null;
    const e = await prisma.employee.create({
      data: {
        propertyId,
        userId: account?.id ?? null,
        name: s.name,
        phone: s.phone,
        jobRole: s.jobRole,
        payType: s.payType,
        payAmount: s.payAmount,
        hiredDate: dateOnly(addDaysIso(today, -200 + i * 30)),
      },
    });
    if (i < 4)
      await prisma.laborContract.create({
        data: {
          employeeId: e.id,
          status: i < 3 ? 'SIGNED' : 'SENT',
          startDate: e.hiredDate,
          payType: e.payType,
          payAmount: e.payAmount,
          tokenHash: `seed-${e.id}`,
          signedAt: i < 3 ? new Date() : null,
        },
      });
    // 이번 달 1일부터 어제까지 근무 (주 2일 휴무), 오늘은 주간 근무자만 출근
    for (let d = `${month}-01`; d <= addDaysIso(today, 13); d = addDaysIso(d, 1)) {
      const off = (dateOnly(d).getUTCDay() + i) % 7 < 2;
      await prisma.workShift.create({
        data: { employeeId: e.id, workDate: dateOnly(d), shiftType: off ? 'OFF' : s.shift },
      });
      if (off || d > today) continue;
      if (d === today && (s.shift === 'NIGHT' || i === 4)) continue;
      const [inT, outT, outDay] = s.shift === 'NIGHT' ? ['22:00', '07:00', addDaysIso(d, 1)] : ['09:00', '16:00', d];
      await prisma.attendance.create({
        data: {
          employeeId: e.id,
          workDate: dateOnly(d),
          clockInAt: kst(d, i === 2 && d === today ? '09:12' : inT),
          clockOutAt: d === today ? null : i === 2 && d === addDaysIso(today, -1) ? null : kst(outDay, outT),
        },
      });
    }
  }

  const vendors = [
    ['한빛어메니티', 'AMENITY', 420_000],
    ['클린워시 세탁', 'LAUNDRY', 680_000],
    ['한국전력', 'UTILITY', 1_240_000],
    ['서울도시가스', 'UTILITY', 380_000],
    ['새벽시장 식자재', 'FOOD', 260_000],
    ['우리설비', 'REPAIR', 150_000],
  ] as const;
  for (const back of [1, 0]) {
    const m = addMonths(month, -back);
    for (const [j, [vendor, category, amount]] of vendors.entries()) {
      const date = `${m}-${String(3 + j * 4).padStart(2, '0')}`;
      if (date > today) continue;
      await prisma.expense.create({
        data: {
          propertyId,
          expenseDate: dateOnly(date),
          vendor,
          category,
          amount: Math.round((amount * (back ? 0.95 : 1)) / 1000) * 1000,
          source: category === 'UTILITY' ? 'CARD' : 'MANUAL',
          createdById: ownerId,
        },
      });
    }
  }
  await prisma.purchaseOrder.createMany({
    data: [
      { propertyId, itemName: '일회용 칫솔 세트', quantity: 10, unit: '박스', vendor: '한빛어메니티', amount: 180_000 },
      {
        propertyId,
        itemName: '수건 (화이트)',
        quantity: 100,
        unit: '장',
        vendor: '클린워시 세탁',
        amount: 320_000,
        category: 'LAUNDRY',
        status: 'ORDERED',
        orderedAt: new Date(),
      },
    ],
  });
  // 30일 무료 체험 중인 서비스 추가 (리뷰·매출장부는 업장 등록 때 시작됨)
  await prisma.subscription.createMany({
    data: (['STAFF', 'EXPENSE'] as const).map((planCode) => ({
      propertyId,
      planCode,
      trialEndsAt: dateOnly(addDaysIso(today, 30)),
    })),
    skipDuplicates: true,
  });
  await seedOps(prisma, propertyId, ownerId);
}

/** 현장 업무 — 객실 42개(2~7층 × 7) 상태 · 공지 · 인수인계 (F7) */
async function seedOps(prisma: PrismaService, propertyId: string, ownerId: string) {
  const types = [
    '스탠다드 더블',
    '스탠다드 더블',
    '디럭스 트윈',
    '디럭스 트윈',
    '디럭스 더블',
    '패밀리 트윈',
    '스위트',
  ];
  // 오후 2시 무렵 — 퇴실한 방 청소가 한창인 시간대
  const pattern = ['OCCUPIED', 'DIRTY', 'READY', 'CLEANING', 'OCCUPIED', 'INSPECT', 'READY'] as const;
  const rooms = [];
  for (let floor = 2; floor <= 7; floor++)
    for (let n = 1; n <= 7; n++) {
      const i = (floor - 2) * 7 + (n - 1);
      rooms.push({
        propertyId,
        number: `${floor}0${n}`,
        floor,
        roomType: types[n - 1],
        sortOrder: i,
        status: floor === 6 && n === 3 ? ('OUT_OF_ORDER' as const) : pattern[(i * 3 + floor) % pattern.length],
        memo: floor === 6 && n === 3 ? '욕실 배수구 막힘 — 수리 업체 내일 오전 방문' : null,
        statusChangedById: ownerId,
        statusChangedAt: new Date(Date.now() - (i % 9) * 17 * 60_000),
      });
    }
  await prisma.room.createMany({ data: rooms });
  const staff = await prisma.user.findMany({ where: { phone: { in: ['01011112222', '01022223333'] } } });
  const minji = staff.find((u) => u.phone === '01011112222');
  const seojun = staff.find((u) => u.phone === '01022223333');
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
  const notes = [
    {
      kind: 'NOTICE' as const,
      isPinned: true,
      authorId: ownerId,
      createdAt: hoursAgo(30),
      body: '이번 주 목요일 오전 10시~12시 전 객실 소독 방역이 있어요. 해당 시간 체크인 고객께 미리 안내 부탁드려요.',
    },
    {
      kind: 'NOTICE' as const,
      authorId: ownerId,
      createdAt: hoursAgo(75),
      body: '12월부터 조식 시간이 7:00~9:30 으로 바뀝니다. 안내문 교체해 주세요.',
    },
    {
      kind: 'HANDOVER' as const,
      shift: 'NIGHT' as const,
      authorId: seojun?.id ?? ownerId,
      createdAt: hoursAgo(6),
      body: '603호 욕실 배수 느림 — 판매 중지 걸어 뒀어요.\n412호 고객 레이트 체크아웃 13시까지 허용(사장님 확인).\n주차장 B2 출입 리모컨 1개 분실, 프런트 서랍 예비 사용 중.',
    },
    {
      kind: 'HANDOVER' as const,
      shift: 'DAY' as const,
      authorId: minji?.id ?? ownerId,
      createdAt: hoursAgo(20),
      body: '오늘 단체 예약(여기어때 6실) 18시 도착 예정. 5층 객실로 배정해 뒀어요.',
    },
  ];
  for (const n of notes) {
    const note = await prisma.opsNote.create({ data: { propertyId, ...n } });
    await prisma.opsNoteRead.create({ data: { noteId: note.id, userId: n.authorId } });
  }
}

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
const prisma = app.get(PrismaService);

// --reset: 구독 상품(기준 데이터)만 남기고 모두 지운다 — 운영 서버에서는 절대 실행하지 않는다
if (process.argv.includes('--reset')) {
  if (process.env.NODE_ENV === 'production') throw new Error('운영(production)에서는 --reset 을 쓸 수 없어요.');
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'wj_plan')`;
  if (rows.length) await prisma.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} CASCADE`);
  console.log('예시 데이터를 지웠어요. 다시 만들어요…');
}
const existing = await prisma.user.findUnique({ where: { phone: PHONE } });
let extraFor: { propertyId: string; ownerId: string } | null = null;
if (existing) {
  console.log('이미 예시 데이터가 있어요. (010-0000-0000)');
} else {
  const now = new Date();
  const user = await prisma.user.create({
    data: {
      phone: PHONE,
      name: '정현',
      passwordHash: await bcrypt.hash('woojoo1234', 10),
      termsAgreedAt: now,
      privacyAgreedAt: now,
    },
  });
  const property = await app.get(PropertiesService).create(user.id, {
    name: '스테이 오르빗 을지로',
    type: 'HOTEL',
    address: '서울 중구 을지로 OO길 12',
    rooms: 42,
    bizNo: '1234567891',
    ownerName: '정현',
  });
  const channels = app.get(ChannelsService);
  for (const ch of CHANNELS) {
    await channels.connect(property.id, ch, { loginId: 'orbit', password: 'sample', consent: true });
    // 매출 추이(10개월)가 보이도록 300일치를 더 가져온다
    await channels.sync(property.id, ch, 300);
  }
  await seedBusiness(prisma, property.id, user.id);
  await app.get(BillingService).setCard(property.id, 'seed-card');
  console.log(`예시 데이터를 만들었어요. 업장 ${property.id} · 로그인 010-0000-0000 / woojoo1234`);
  extraFor = { propertyId: property.id, ownerId: user.id };
}

if (!(await prisma.adminUser.findUnique({ where: { email: 'admin@woojoo.kr' } }))) {
  await createAdminUser(prisma, { email: 'admin@woojoo.kr', name: '운영팀', password: 'Woojoo1234!', role: 'SUPER' });
  await prisma.inquiry.createMany({
    data: [
      {
        type: 'INTRO',
        contactName: '한소영',
        phone: '01012345678',
        propertyName: '호텔 한결 해운대',
        propertyType: 'HOTEL',
        rooms: 58,
        message: '지금 쓰는 PMS 를 바꾸려고 해요. 리뷰 답글이랑 정산 확인이 제일 급합니다.',
      },
      {
        type: 'INTRO',
        contactName: '박준호',
        phone: '01098765432',
        propertyName: '솔바람 펜션',
        propertyType: 'PENSION',
        rooms: 8,
        message: '알바 출퇴근이랑 급여 계산도 되나요?',
      },
      { type: 'PARTNER', contactName: '이수민', phone: '0215880000', message: '어메니티 공급 제휴 문의드립니다.' },
    ],
  });
  console.log('운영자 계정을 만들었어요. admin@woojoo.kr / Woojoo1234!');
}
// 운영자 계정이 있어야 실증 업장에 담당 매니저를 붙일 수 있어 맨 뒤에
if (extraFor) {
  await seedExtra(app, extraFor);
  console.log(
    [
      '추가 예시 데이터를 만들었어요.',
      '  정현     010-0000-0000 / woojoo1234 (스테이 오르빗 을지로 외 9곳 — 로그인하면 전체 현황)',
      '  매니저   010-4444-5555 / woojoo1234 (스테이 오르빗 을지로)',
      '  한소영   010-2000-0000 / woojoo1234 (업장 10곳 — 로그인하면 전체 현황)',
      '  루오     010-3000-0000 / woojoo1234 · 브라운도트 010-4000-0000 · N7 010-5000-0000 (각 업장 매니저)',
    ].join('\n'),
  );
}
await app.close();
