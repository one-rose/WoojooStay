/**
 * 실증(파일럿) 예시 데이터 — 운영자 '실증 KPI' 화면이 비어 보이지 않게.
 * 사업소개서 실증 5곳에 묶음 "대전 1차", 시작일 = 오늘 − 10일 을 넣고
 * 기준선(시작 전 90일) · 1~2주 차의 리뷰·답글 · 사용 기록 · 채널 평점 · 지출 · 급여 · 계약 · 설문 값 · 지원 메모를 만든다.
 * - 시작 전 리뷰의 답글은 사장님이 파트너센터에서 직접 단 것 → EXTERNAL (KPI 에서 빠짐)
 * - 시작 뒤에는 앱에서 초안을 보고 게시 (응답 시간이 주마다 줄고, 초안을 그대로 쓰는 비율이 늘게)
 */
import { CHANNEL_CATALOG } from './connectors/catalog.js';
import { addDaysIso, addMonths, dateOnly, kstDate, monthStart } from './common/utils/dates.js';
import type { Prisma } from './generated/prisma/client.js';
import type { Channel, ExpenseCategory, ExpenseSource } from './generated/prisma/enums.js';
import type { PrismaService } from './prisma/prisma.service.js';

export const PILOT_GROUP = '대전 1차';
const PILOT_AGO_DAYS = 10;
const BASELINE_DAYS = 90;

/** 문자열로 만드는 0~1 고정 난수 (다시 돌려도 같은 데이터) */
function rand(seed: string): number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}
const kst = (d: string, hour: number) => new Date(`${d}T${String(Math.min(23, hour)).padStart(2, '0')}:00:00+09:00`);

const BODIES: { rating: number; body: string }[] = [
  { rating: 5, body: '직원분들이 친절하고 방이 정말 깨끗했어요. 다음에 또 올게요.' },
  { rating: 5, body: '위치가 좋아서 이동이 편했어요. 침구도 포근했습니다.' },
  { rating: 4, body: '가격 대비 만족스러웠어요. 다만 주차 공간이 조금 좁았어요.' },
  { rating: 4, body: '조용하고 쉬기 좋았습니다. 어메니티가 조금 더 있으면 좋겠어요.' },
  { rating: 3, body: '방은 괜찮았는데 체크인 대기가 길었어요.' },
  { rating: 2, body: '에어컨 소리가 커서 잠을 설쳤어요. 프런트에 말했는데 해결이 안 됐어요.' },
  { rating: 1, body: '예약한 방과 다른 방을 받았어요. 설명도 없었습니다.' },
];
const AUTHORS = ['여행자', '출장러', '주말나들이', 'hj_lee', '대전사람', '가족여행', 'K.Park', '쉼표'];
const VENDORS: { vendor: string; category: ExpenseCategory; amount: number }[] = [
  { vendor: '대전세탁', category: 'LAUNDRY', amount: 180_000 },
  { vendor: '한빛어메니티', category: 'AMENITY', amount: 95_000 },
  { vendor: '한국전력', category: 'UTILITY', amount: 420_000 },
  { vendor: '둔산철물', category: 'REPAIR', amount: 38_000 },
  { vendor: '이마트 둔산점', category: 'FOOD', amount: 64_000 },
];
const SURVEYS = [
  {
    channelCheckMinutes: 70,
    payrollMethod: '엑셀',
    payrollMinutes: 240,
    staffCount: 6,
    monthlyExpenseCount: 45,
    recordMethod: '엑셀 + 영수증 보관함',
  },
  {
    channelCheckMinutes: 90,
    payrollMethod: '세무사 위탁',
    payrollMinutes: 120,
    staffCount: 8,
    monthlyExpenseCount: 60,
    recordMethod: '회계 프로그램',
  },
  {
    channelCheckMinutes: 45,
    payrollMethod: '수기 장부',
    payrollMinutes: 300,
    staffCount: 3,
    monthlyExpenseCount: 30,
    recordMethod: '수기 장부',
  },
  {
    channelCheckMinutes: 60,
    payrollMethod: '엑셀',
    payrollMinutes: 180,
    staffCount: 4,
    monthlyExpenseCount: 35,
    recordMethod: '카드 내역만',
  },
  { channelCheckMinutes: 30, payrollMethod: '수기', payrollMinutes: 150, staffCount: 2, monthlyExpenseCount: 20 },
];

export async function seedPilot(prisma: PrismaService, ownerPhone: string, names: string[]) {
  const owner = await prisma.user.findUnique({ where: { phone: ownerPhone } });
  if (!owner) return;
  const today = kstDate();
  const start = addDaysIso(today, -PILOT_AGO_DAYS);
  const baseFrom = addDaysIso(start, -BASELINE_DAYS);
  const nowMs = Date.now();
  const admin = await prisma.adminUser.findUnique({ where: { email: 'admin@woojoo.kr' } });
  const props = await prisma.property.findMany({
    where: { name: { in: names }, memberships: { some: { userId: owner.id, role: 'OWNER' } } },
    include: {
      channels: { select: { channel: true } },
      memberships: { where: { role: { in: ['OWNER', 'MANAGER'] } }, select: { userId: true, role: true } },
      employees: { select: { id: true, payAmount: true, jobRole: true, hiredDate: true } },
    },
  });
  const events: Prisma.UsageEventCreateManyInput[] = [];
  const userDays = new Set<string>();
  /** 사용자 단위 기록은 사람마다 하루 한 번 (업장 여러 곳이어도) */
  const userEvent = (kind: string, userId: string, d: string, hour: number) => {
    const key = `${kind}:${userId}:${d}`;
    if (userDays.has(key)) return;
    userDays.add(key);
    events.push({ kind, userId, createdAt: kst(d, hour) });
  };

  for (const [k, p] of props.entries()) {
    const ord = names.indexOf(p.name);
    await prisma.property.update({
      where: { id: p.id },
      data: { pilotGroup: PILOT_GROUP, pilotStartedAt: dateOnly(start) },
    });
    const channels = p.channels.map((c) => c.channel as Channel);
    const managers = p.memberships.filter((m) => m.role === 'MANAGER').map((m) => m.userId);

    // ── 리뷰 · 초안 · 답글 ──
    let seq = 0;
    for (let d = baseFrom; d < today; d = addDaysIso(d, 1)) {
      const pilot = d >= start;
      const week = pilot ? Math.floor((dateOnly(d).getTime() - dateOnly(start).getTime()) / (7 * 86_400_000)) + 1 : 0;
      for (const ch of channels) {
        const seed = `${p.id}${ch}${d}`;
        if (rand(seed) > 0.32) continue;
        seq += 1;
        const tpl = BODIES[Math.floor(rand(`${seed}b`) * BODIES.length)];
        const postedAt = kst(d, 9 + Math.floor(rand(`${seed}h`) * 13));
        const mode = CHANNEL_CATALOG[ch].replyMode;
        // 시작 전: 사장님이 파트너센터에서 직접 단 답글(EXTERNAL) 45% · 시작 뒤: 앱에서 게시 (주마다 늘어남)
        const replied = pilot ? rand(`${seed}r`) < 0.7 + week * 0.1 : rand(`${seed}r`) < 0.45;
        const hours = pilot ? Math.max(1, 20 - week * 7 + rand(`${seed}t`) * 10) : 30 + rand(`${seed}t`) * 60;
        const replyAt = new Date(postedAt.getTime() + hours * 3_600_000);
        const answered = replied && replyAt.getTime() < nowMs - 60_000;
        const edited = rand(`${seed}e`) < (week >= 2 ? 0.25 : 0.45);
        const review = await prisma.review.create({
          data: {
            propertyId: p.id,
            channel: ch,
            externalId: `pilot-${seq}`,
            author: AUTHORS[Math.floor(rand(`${seed}a`) * AUTHORS.length)],
            rating: tpl.rating,
            body: tpl.body,
            photos: [],
            postedAt,
            sentiment: tpl.rating >= 4 ? 'POSITIVE' : 'IMPROVE',
            status: answered ? 'POSTED' : 'UNANSWERED',
            createdAt: pilot ? postedAt : kst(start, 10),
            ...(pilot
              ? {
                  draft: {
                    create: {
                      text: '소중한 후기 감사합니다. 말씀해 주신 부분은 바로 살펴보고, 다음 방문 때 더 편히 쉬실 수 있게 준비하겠습니다.',
                      keywords: [],
                      generator: 'template',
                    },
                  },
                }
              : {}),
            ...(answered
              ? {
                  reply: {
                    create: pilot
                      ? {
                          text: edited
                            ? '찾아 주셔서 감사합니다. 불편하셨던 점은 직원들과 함께 바로 고치겠습니다.'
                            : '소중한 후기 감사합니다. 말씀해 주신 부분은 바로 살펴보고, 다음 방문 때 더 편히 쉬실 수 있게 준비하겠습니다.',
                          via: mode === 'API' ? 'API' : 'COPY',
                          postedById: owner.id,
                          postedAt: replyAt,
                          draftEdited: edited,
                        }
                      : {
                          text: '감사합니다. 또 방문해 주세요.',
                          via: 'EXTERNAL',
                          // 채널이 답글 시각을 주지 않는 경우도 섞어 둔다
                          postedAt: rand(`${seed}n`) < 0.3 ? null : replyAt,
                        },
                  },
                }
              : {}),
          },
        });
        if (pilot) {
          events.push({
            kind: 'DRAFT_CREATE',
            propertyId: p.id,
            meta: { reviewId: review.id, auto: true },
            createdAt: postedAt,
          });
          if (answered) {
            if (rand(`${seed}g`) < 0.2)
              events.push({
                kind: 'DRAFT_REGENERATE',
                userId: owner.id,
                propertyId: p.id,
                meta: { reviewId: review.id, revision: 1 },
                createdAt: new Date(replyAt.getTime() - 120_000),
              });
            events.push({
              kind: 'REPLY_POST',
              userId: owner.id,
              propertyId: p.id,
              meta: { reviewId: review.id, via: mode === 'API' ? 'API' : 'COPY', edited },
              createdAt: replyAt,
            });
          }
        }
      }
    }

    // ── 채널 평점 (하루 한 줄) — 실증 시작 뒤 조금씩 오른다 ──
    const ratings: Prisma.RatingSnapshotCreateManyInput[] = [];
    for (let d = baseFrom; d <= today; d = addDaysIso(d, 1)) {
      const since = Math.max(0, (dateOnly(d).getTime() - dateOnly(start).getTime()) / 86_400_000);
      for (const ch of channels) {
        const base = 3.9 + rand(`${p.id}${ch}base`) * 0.6;
        const value = base + since * 0.01 + (rand(`${p.id}${ch}${d}w`) - 0.5) * 0.04;
        ratings.push({
          propertyId: p.id,
          channel: ch,
          date: dateOnly(d),
          rating: Math.round(Math.min(5, value) * 100) / 100,
          reviewCount:
            300 + Math.round(rand(`${p.id}${ch}c`) * 900) + Math.round((dateOnly(d).getTime() / 86_400_000) % 1000),
        });
      }
    }
    // 첫 수집 때 예시 연결이 남긴 오늘 평점은 이 흐름으로 바꾼다
    await prisma.ratingSnapshot.deleteMany({ where: { propertyId: p.id } });
    if (ratings.length) await prisma.ratingSnapshot.createMany({ data: ratings, skipDuplicates: true });

    // ── 사용 기록 (실증 시작 뒤) ──
    for (let d = start; d <= today; d = addDaysIso(d, 1)) {
      const seed = `${p.id}${d}`;
      if (rand(`${owner.id}${d}open`) < 0.9) userEvent('APP_OPEN', owner.id, d, 8);
      if (rand(`${owner.id}${d}ov`) < 0.75) userEvent('OVERVIEW_VIEW', owner.id, d, 8);
      for (const m of managers) if (rand(`${m}${d}`) < 0.7) userEvent('APP_OPEN', m, d, 9);
      if (rand(`${seed}ledger`) < 0.45 + k * 0.05)
        events.push({ kind: 'LEDGER_VIEW', userId: owner.id, propertyId: p.id, createdAt: kst(d, 21) });
      if (channels.length && rand(`${seed}room`) < 0.8)
        events.push({ kind: 'ROOM_STATUS', userId: managers[0] ?? owner.id, propertyId: p.id, createdAt: kst(d, 11) });
    }
    if (channels.length)
      events.push({
        kind: 'CHANNEL_CONNECT',
        userId: owner.id,
        propertyId: p.id,
        meta: { channel: channels[0] },
        createdAt: kst(start, 10),
      });

    // ── 지출 — 시작 전에는 직접 입력 위주, 뒤에는 영수증·카드·발주 ──
    const expenses: Prisma.ExpenseCreateManyInput[] = [];
    for (let d = baseFrom; d < today; d = addDaysIso(d, 1)) {
      const seed = `${p.id}${d}x`;
      if (rand(seed) > 0.33) continue;
      const v = VENDORS[Math.floor(rand(`${seed}v`) * VENDORS.length)];
      const r = rand(`${seed}s`);
      const source: ExpenseSource =
        d >= start
          ? r < 0.5
            ? 'RECEIPT'
            : r < 0.75
              ? 'CARD'
              : r < 0.85
                ? 'ORDER'
                : 'MANUAL'
          : r < 0.2
            ? 'CARD'
            : 'MANUAL';
      expenses.push({
        propertyId: p.id,
        expenseDate: dateOnly(d),
        vendor: v.vendor,
        category: v.category,
        amount: Math.round((v.amount * (0.7 + rand(`${seed}a`) * 0.6)) / 1000) * 1000,
        source,
        createdById: owner.id,
        createdAt: kst(d, 18),
      });
    }
    if (expenses.length) await prisma.expense.createMany({ data: expenses });
    for (const e of expenses.filter((x) => x.source === 'RECEIPT'))
      events.push({ kind: 'RECEIPT_REGISTER', userId: owner.id, propertyId: p.id, createdAt: e.createdAt as Date });

    // ── 급여(지난달) 확정·명세 발송 1주 차 · 근로계약 서명 ──
    const lastMonth = addMonths(today.slice(0, 7), -1);
    for (const [i, e] of p.employees.entries()) {
      const hours = 120 + i * 8;
      const base = e.payAmount * hours;
      await prisma.payroll.upsert({
        where: { employeeId_month: { employeeId: e.id, month: monthStart(lastMonth) } },
        create: {
          employeeId: e.id,
          month: monthStart(lastMonth),
          workHours: hours,
          nightHours: e.jobRole === 'NIGHT' ? 60 : 0,
          baseAmount: base,
          nightAmount: e.jobRole === 'NIGHT' ? Math.round(e.payAmount * 0.5 * 60) : 0,
          weeklyAmount: Math.round(e.payAmount * 8 * 4),
          totalAmount: base + (e.jobRole === 'NIGHT' ? Math.round(e.payAmount * 0.5 * 60) : 0) + e.payAmount * 32,
          status: 'SENT',
          confirmedAt: kst(addDaysIso(start, 2), 10),
          sentAt: kst(addDaysIso(start, 3), 10),
        },
        update: {},
      });
      const signed = addDaysIso(start, 1 + i * 3);
      if (signed < today)
        await prisma.laborContract.create({
          data: {
            employeeId: e.id,
            status: 'SIGNED',
            startDate: e.hiredDate,
            payType: 'HOURLY',
            payAmount: e.payAmount,
            tokenHash: `seed-pilot-${e.id}`,
            sentAt: kst(signed, 9),
            signedAt: kst(signed, 15),
          },
        });
    }
    if (p.employees.length)
      events.push({
        kind: 'PAYROLL_CONFIRM',
        userId: owner.id,
        propertyId: p.id,
        meta: { month: lastMonth },
        createdAt: kst(addDaysIso(start, 2), 10),
      });

    // ── 출근 — 앱 기록(사용 기록) · 몇 건은 사장님이 고친 기록으로 ──
    // 실증 전에는 종이·엑셀로 적던 기록 (앱 기록 아님)
    await prisma.attendance.updateMany({
      where: { employee: { propertyId: p.id }, workDate: { lt: dateOnly(start) } },
      data: { method: 'MANUAL' },
    });
    const attendance = await prisma.attendance.findMany({
      where: { employee: { propertyId: p.id }, workDate: { gte: dateOnly(start) } },
      select: { id: true, clockInAt: true, employeeId: true },
      orderBy: { clockInAt: 'asc' },
    });
    for (const [i, a] of attendance.entries()) {
      if (i % 7 === 3) {
        await prisma.attendance.update({
          where: { id: a.id },
          data: { method: 'MANUAL', editedAt: a.clockInAt, editedById: owner.id, memo: '출근 버튼을 못 눌렀어요' },
        });
        continue;
      }
      events.push({
        kind: 'CLOCK_IN',
        propertyId: p.id,
        meta: { employeeId: a.employeeId, method: 'GPS', self: true },
        createdAt: a.clockInAt,
      });
    }

    // ── 설문 값 · 지원 메모 ──
    const sv = SURVEYS[ord] ?? SURVEYS[0];
    await prisma.pilotSurvey.upsert({
      where: { propertyId: p.id },
      create: {
        propertyId: p.id,
        ...sv,
        baselineMemo: '실증 전 화상 인터뷰 (운영팀 기록)',
        ...(ord < 2 ? { wtpPlan: '베이직', wtpProperties: 1, wtpMemo: '4채널 장부가 되면 유료 전환 생각 있음' } : {}),
        updatedById: admin?.id ?? null,
      },
      update: {},
    });
    if (admin)
      await prisma.supportNote.createMany({
        data: [
          {
            propertyId: p.id,
            adminId: admin.id,
            kind: 'VISIT',
            body: '현장 방문 — 파트너센터 계정 연동 같이 진행, 프런트 직원 2명 앱 설치 안내',
            createdAt: kst(start, 14),
          },
          {
            propertyId: p.id,
            adminId: admin.id,
            kind: 'CALL',
            body:
              channels.length === 0
                ? '전화 — 채널 계정 아이디를 찾는 중이라 다음 주에 다시 연락 주시기로 함'
                : '전화 — 답글 초안 문장이 딱딱하다는 의견, 말투를 "친근하게" 로 바꿔 드림',
            createdAt: kst(addDaysIso(start, 6), 16),
          },
        ],
      });
  }
  for (let i = 0; i < events.length; i += 1000) await prisma.usageEvent.createMany({ data: events.slice(i, i + 1000) });

  // 최근 접속 — 대표는 오늘 아침, 매니저는 업장마다 다르게 (운영자 '연락할 곳' 확인용)
  const morning = Math.min(nowMs - 60_000, kst(today, 8).getTime() + 12 * 60_000);
  await prisma.user.update({ where: { id: owner.id }, data: { lastLoginAt: new Date(morning) } });
  const managerLogin: Record<string, number | null> = { '01030000000': 1, '01040000000': 5, '01050000000': null };
  for (const [phone, daysAgo] of Object.entries(managerLogin))
    await prisma.user.updateMany({
      where: { phone },
      data: { lastLoginAt: daysAgo === null ? null : new Date(nowMs - daysAgo * 86_400_000 - 3 * 3_600_000) },
    });
}
