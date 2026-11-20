import { Injectable } from '@nestjs/common';
import { Errors } from '../common/errors/app-error.js';
import { addDaysIso, addMonths, dateOnly, isoDay, kstDate, monthStart } from '../common/utils/dates.js';
import { PILOT_BASELINE_DAYS, PILOT_WEEKS, pilotInfo } from '../common/utils/pilot.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PilotSurveyDto, SupportNoteDto } from './dto/pilot.dto.js';

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);
const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 1000 : null);
const KST_DAY = (col: string) => Prisma.raw(`((${col}) AT TIME ZONE 'Asia/Seoul')::date`);

/** 활성화 단계 — 가입 → 업장 → 채널 연결 → 첫 수집 → 첫 답글 (PO-12) */
export const ACTIVATION_STEPS = ['SIGNUP', 'PROPERTY', 'CHANNEL', 'FIRST_SYNC', 'FIRST_REPLY'] as const;
export type ActivationStep = (typeof ACTIVATION_STEPS)[number];
export const ACTIVATION_LABEL: Record<ActivationStep, string> = {
  SIGNUP: '가입',
  PROPERTY: '업장 등록',
  CHANNEL: '채널 연결',
  FIRST_SYNC: '첫 수집',
  FIRST_REPLY: '첫 답글',
};

export interface Activation {
  /** 마친 마지막 단계 */
  stage: ActivationStep;
  /** 아직 못 마친 첫 단계 (다 마쳤으면 null) */
  blocked: ActivationStep | null;
  /** 막힌 단계 바로 앞 단계를 마친 시각 — 이때부터 멈춰 있음 */
  stuckSince: Date | null;
  steps: { key: ActivationStep; label: string; done: boolean; at: Date | null }[];
}

/** 운영팀 연락 기준 (PO-18) */
export const NO_CHANNEL_HOURS = 72;
export const UNANSWERED_HOURS = 48;
export const NO_LOGIN_DAYS = 3;

/** KPI 화면에 고정해 보여 줄 정의 문구 (PO-06·07) */
export const KPI_DEFINITIONS = {
  week: `실증 시작일부터 7일씩 1~${PILOT_WEEKS}주. 기준선은 시작 전 ${PILOT_BASELINE_DAYS}일.`,
  responseRate:
    '그 주에 채널에 올라온 리뷰 중 우주스테이로 답글을 단 비율. 수집할 때 채널에 이미 답글이 있던 리뷰는 빼고 센다.',
  responseTime:
    '리뷰가 채널에 올라온 시각부터 우주스테이로 답글을 게시한 시각까지의 중앙값(시간). 그 주에 올라온 리뷰 기준.',
  draftAsIs: '그 주에 게시한 답글 중 AI 초안을 고치지 않고 그대로 게시한 비율 (공백 차이는 같은 문장으로 봄).',
  activeDays: '사장님·매니저가 앱을 열거나 기능을 쓴 날 수 (한국 날짜 기준).',
  ledgerDays: '매출장부·전체 현황·업장 비교를 본 날 수.',
  expenseDigital: '그 주 지출 중 영수증 사진·카드 내역·발주로 들어온 비율 (직접 입력 제외).',
  attendanceApp: '그 주 출근 기록 중 앱으로 찍고 나중에 고치지 않은 비율.',
  rating: '그 주 마지막으로 수집한 채널별 평점의 평균. 변화는 기준선 마지막 값과 비교.',
  aiUsage: '초안 생성(수집 때 자동) · 다시 쓰기 · 답글 게시 건수.',
} as const;

/** 실증 측정 · 운영 도구 — 운영자 화면 (PO-03 ~ PO-08, PO-12, PO-14 ~ PO-18, PO-23) */
@Injectable()
export class PilotService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── 실증 업장 지정 ─────────────────────────────────────
  async setPilot(propertyId: string, group: string | null | undefined, startedAt: string | null | undefined) {
    const exists = await this.prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } });
    if (!exists) throw Errors.notFound('업장');
    const name = group?.trim() || null;
    await this.prisma.property.update({
      where: { id: propertyId },
      data: name
        ? { pilotGroup: name, pilotStartedAt: dateOnly(startedAt ?? kstDate()) }
        : { pilotGroup: null, pilotStartedAt: null },
    });
  }

  // ─── 활성화 단계 ────────────────────────────────────────
  async activation(ids: readonly string[]): Promise<Map<string, Activation>> {
    const out = new Map<string, Activation>();
    if (ids.length === 0) return out;
    const idList = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));
    const [props, channels, replies] = await Promise.all([
      this.prisma.property.findMany({
        where: { id: { in: [...ids] } },
        select: {
          id: true,
          createdAt: true,
          memberships: {
            where: { role: 'OWNER' },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { user: { select: { createdAt: true } } },
          },
        },
      }),
      this.prisma.$queryRaw<{ property_id: string; first_at: Date; synced_at: Date | null }[]>(Prisma.sql`
        SELECT property_id::text AS property_id, MIN(created_at) AS first_at, MIN(last_synced_at) AS synced_at
        FROM wj_channel_account WHERE property_id IN (${idList}) GROUP BY property_id`),
      this.prisma.$queryRaw<{ property_id: string; first_at: Date | null }[]>(Prisma.sql`
        SELECT v.property_id::text AS property_id, MIN(r.posted_at) AS first_at
        FROM wj_review_reply r JOIN wj_review v ON v.id = r.review_id
        WHERE v.property_id IN (${idList}) AND r.post_method <> 'EXTERNAL'
        GROUP BY v.property_id`),
    ]);
    const chBy = new Map(channels.map((r) => [r.property_id, r]));
    const rpBy = new Map(replies.map((r) => [r.property_id, r]));
    for (const p of props) {
      const ch = chBy.get(p.id);
      const rp = rpBy.get(p.id);
      const at: Record<ActivationStep, Date | null> = {
        SIGNUP: p.memberships[0]?.user.createdAt ?? p.createdAt,
        PROPERTY: p.createdAt,
        CHANNEL: ch?.first_at ?? null,
        FIRST_SYNC: ch?.synced_at ?? null,
        // 답글은 있는데 시각이 없을 일은 없지만(EXTERNAL 제외) 혹시 몰라 있음으로만 본다
        FIRST_REPLY: rp ? (rp.first_at ?? p.createdAt) : null,
      };
      const steps = ACTIVATION_STEPS.map((key) => ({
        key,
        label: ACTIVATION_LABEL[key],
        done: !!at[key],
        at: at[key],
      }));
      const firstOpen = steps.findIndex((s) => !s.done);
      const blocked = firstOpen === -1 ? null : steps[firstOpen].key;
      const lastDone = firstOpen === -1 ? steps.length - 1 : Math.max(0, firstOpen - 1);
      out.set(p.id, {
        stage: steps[lastDone].key,
        blocked,
        stuckSince: blocked ? steps[lastDone].at : null,
        steps,
      });
    }
    return out;
  }

  // ─── 연락할 곳 (PO-18) ──────────────────────────────────
  async attention(now = new Date()) {
    const noChannelBefore = new Date(now.getTime() - NO_CHANNEL_HOURS * 3_600_000);
    const unansweredBefore = new Date(now.getTime() - UNANSWERED_HOURS * 3_600_000);
    const loginBefore = new Date(now.getTime() - NO_LOGIN_DAYS * 86_400_000);
    const rows = await this.prisma.property.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        name: true,
        createdAt: true,
        pilotGroup: true,
        manager: { select: { id: true, name: true } },
        _count: {
          select: { channels: true, reviews: { where: { status: 'UNANSWERED', postedAt: { lt: unansweredBefore } } } },
        },
        memberships: {
          where: { role: { in: ['OWNER', 'MANAGER'] } },
          select: { role: true, user: { select: { id: true, name: true, phone: true, lastLoginAt: true } } },
        },
        reviews: {
          where: { status: 'UNANSWERED', postedAt: { lt: unansweredBefore } },
          orderBy: { postedAt: 'asc' },
          take: 1,
          select: { postedAt: true },
        },
      },
    });
    const items = rows
      .map((p) => {
        const owner = p.memberships.find((m) => m.role === 'OWNER')?.user ?? null;
        const logins = p.memberships.map((m) => m.user.lastLoginAt?.getTime() ?? 0);
        const lastLogin = logins.length && Math.max(...logins) > 0 ? new Date(Math.max(...logins)) : null;
        const reasons: { kind: 'NO_CHANNEL' | 'UNANSWERED' | 'NO_LOGIN'; text: string }[] = [];
        if (p._count.channels === 0 && p.createdAt < noChannelBefore)
          reasons.push({
            kind: 'NO_CHANNEL',
            text: `가입 ${NO_CHANNEL_HOURS}시간이 지나도록 채널을 연결하지 않았어요.`,
          });
        if (p._count.reviews > 0)
          reasons.push({
            kind: 'UNANSWERED',
            text: `${UNANSWERED_HOURS}시간 넘게 답글을 기다리는 리뷰가 ${p._count.reviews}건 있어요.`,
          });
        if (!lastLogin || lastLogin < loginBefore)
          reasons.push({
            kind: 'NO_LOGIN',
            text: lastLogin ? `${NO_LOGIN_DAYS}일 넘게 접속하지 않았어요.` : '가입 뒤 접속 기록이 없어요.',
          });
        return {
          property: { id: p.id, name: p.name, pilotGroup: p.pilotGroup },
          owner: owner ? { id: owner.id, name: owner.name, phone: owner.phone } : null,
          manager: p.manager,
          lastLoginAt: lastLogin,
          oldestUnansweredAt: p.reviews[0]?.postedAt ?? null,
          reasons,
        };
      })
      .filter((x) => x.reasons.length > 0)
      // 실증 업장 먼저, 사유가 많은 순
      .sort(
        (a, b) =>
          Number(!!b.property.pilotGroup) - Number(!!a.property.pilotGroup) || b.reasons.length - a.reasons.length,
      );
    return {
      rules: {
        noChannelHours: NO_CHANNEL_HOURS,
        unansweredHours: UNANSWERED_HOURS,
        noLoginDays: NO_LOGIN_DAYS,
      },
      items,
    };
  }

  // ─── 지원 메모 (PO-23) ──────────────────────────────────
  async notes(propertyId: string) {
    await this.ensureProperty(propertyId);
    const rows = await this.prisma.supportNote.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { admin: { select: { id: true, name: true } } },
    });
    return rows.map(toNote);
  }

  async addNote(propertyId: string, adminId: string, dto: SupportNoteDto) {
    await this.ensureProperty(propertyId);
    const row = await this.prisma.supportNote.create({
      data: { propertyId, adminId, kind: dto.kind, body: dto.body.trim() },
      include: { admin: { select: { id: true, name: true } } },
    });
    return toNote(row);
  }

  /** 쓴 사람 또는 최고 관리자만 지운다 */
  async removeNote(propertyId: string, noteId: string, admin: { id: string; role: string }) {
    const row = await this.prisma.supportNote.findFirst({ where: { id: noteId, propertyId } });
    if (!row) throw Errors.notFound('메모');
    if (row.adminId !== admin.id && admin.role !== 'SUPER') throw Errors.adminForbidden();
    await this.prisma.supportNote.delete({ where: { id: noteId } });
  }

  // ─── 실증 설문 값 (PO-08, PO-14·15) ──────────────────────
  async saveSurvey(propertyId: string, adminId: string, dto: PilotSurveyDto) {
    await this.ensureProperty(propertyId);
    const data = {
      channelCheckMinutes: dto.channelCheckMinutes,
      payrollMethod: dto.payrollMethod === undefined ? undefined : dto.payrollMethod?.trim() || null,
      payrollMinutes: dto.payrollMinutes,
      staffCount: dto.staffCount,
      monthlyExpenseCount: dto.monthlyExpenseCount,
      recordMethod: dto.recordMethod === undefined ? undefined : dto.recordMethod?.trim() || null,
      baselineMemo: dto.baselineMemo === undefined ? undefined : dto.baselineMemo?.trim() || null,
      satisfaction4w: dto.satisfaction4w,
      satisfaction8w: dto.satisfaction8w,
      satisfactionMemo: dto.satisfactionMemo === undefined ? undefined : dto.satisfactionMemo?.trim() || null,
      wtpPlan: dto.wtpPlan === undefined ? undefined : dto.wtpPlan?.trim() || null,
      wtpProperties: dto.wtpProperties,
      wtpMemo: dto.wtpMemo === undefined ? undefined : dto.wtpMemo?.trim() || null,
      updatedById: adminId,
    };
    const row = await this.prisma.pilotSurvey.upsert({
      where: { propertyId },
      create: { propertyId, ...data },
      update: data,
    });
    return toSurvey(row);
  }

  // ─── AI 답글 사용량 (PO-16) ─────────────────────────────
  /** 최근 months 달, 달마다 초안 생성 · 다시 쓰기 · 게시 수 (한국 날짜 기준) */
  async aiUsage(propertyId: string, months = 6, today = kstDate()) {
    const thisMonth = today.slice(0, 7);
    const from = monthStart(addMonths(thisMonth, -(months - 1)));
    const rows = await this.prisma.$queryRaw<{ month: string; kind: string; count: bigint }[]>(Prisma.sql`
      SELECT to_char(${KST_DAY('created_at')}, 'YYYY-MM') AS month, event_kind AS kind, COUNT(*) AS count
      FROM wj_usage_event
      WHERE property_id = ${propertyId}::uuid
        AND event_kind IN ('DRAFT_CREATE', 'DRAFT_REGENERATE', 'REPLY_POST')
        AND created_at >= ${new Date(`${isoDay(from)}T00:00:00+09:00`)}
      GROUP BY 1, 2`);
    return Array.from({ length: months }, (_, i) => {
      const m = addMonths(thisMonth, i - months + 1);
      const c = (k: string) => n(rows.find((r) => r.month === m && r.kind === k)?.count);
      return { month: m, drafts: c('DRAFT_CREATE'), regenerations: c('DRAFT_REGENERATE'), posts: c('REPLY_POST') };
    });
  }

  // ─── 실증 KPI (PO-06 · PO-07 · PO-08) ───────────────────
  async groups() {
    const rows = await this.prisma.property.groupBy({
      by: ['pilotGroup'],
      where: { pilotGroup: { not: null } },
      _count: { _all: true },
      orderBy: { pilotGroup: 'asc' },
    });
    return rows.map((r) => ({ name: r.pilotGroup as string, properties: r._count._all }));
  }

  async kpi(group?: string, today = kstDate()) {
    const groups = await this.groups();
    const chosen = group ?? groups[0]?.name ?? null;
    const base = { today, groups, group: chosen, weeks: PILOT_WEEKS, definitions: KPI_DEFINITIONS };
    if (!chosen) return { ...base, properties: [] };
    const props = await this.prisma.property.findMany({
      where: { pilotGroup: chosen },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        pilotGroup: true,
        pilotStartedAt: true,
        pilotSurvey: true,
        memberships: {
          where: { role: { in: ['OWNER', 'MANAGER'] } },
          select: { role: true, user: { select: { name: true, phone: true, lastLoginAt: true } } },
        },
      },
    });
    const activation = await this.activation(props.map((p) => p.id));
    const properties = [];
    for (const p of props) {
      const info = pilotInfo(p, today);
      if (!info) continue;
      const owner = p.memberships.find((m) => m.role === 'OWNER')?.user ?? null;
      const weeks = await this.weeks(p.id, info.startedAt, today);
      const current =
        today < info.startedAt ? 0 : Math.min(PILOT_WEEKS, Math.floor(daysBetween(info.startedAt, today) / 7) + 1);
      properties.push({
        id: p.id,
        name: p.name,
        owner: owner ? { name: owner.name, phone: owner.phone, lastLoginAt: owner.lastLoginAt } : null,
        lastLoginAt: latest(p.memberships.map((m) => m.user.lastLoginAt)),
        pilot: { ...info, week: current },
        activation: activation.get(p.id) ?? null,
        survey: p.pilotSurvey ? toSurvey(p.pilotSurvey) : null,
        weeks,
      });
    }
    return { ...base, properties };
  }

  /** 업장 하나의 기준선(0) + 1~8주 */
  private async weeks(propertyId: string, start: string, today: string) {
    const S = dateOnly(start);
    const from = dateOnly(addDaysIso(start, -PILOT_BASELINE_DAYS));
    const end = dateOnly(addDaysIso(start, PILOT_WEEKS * 7)); // 미포함
    const T = dateOnly(today);
    const pid = Prisma.sql`${propertyId}::uuid`;
    /** d(날짜 식) → 주 번호 (0 = 기준선) */
    const bucket = (d: Prisma.Sql) => Prisma.sql`CASE WHEN ${d} < ${S} THEN 0 ELSE ((${d} - ${S}::date) / 7) + 1 END`;
    const inRange = (d: Prisma.Sql) => Prisma.sql`${d} >= ${from} AND ${d} < ${end} AND ${d} <= ${T}`;
    const vDay = KST_DAY('v.posted_at');
    const rDay = KST_DAY('r.posted_at');
    const eDay = KST_DAY('created_at');
    const userIds = Prisma.sql`(SELECT user_id FROM wj_property_member WHERE property_id = ${pid} AND member_role IN ('OWNER', 'MANAGER'))`;

    const [reviews, replies, usage, expenses, payroll, contracts, attendance, ratings] = await Promise.all([
      this.prisma.$queryRaw<{ w: number; total: bigint; answered: bigint; median_h: number | null }[]>(Prisma.sql`
        SELECT ${bucket(vDay)}::int AS w,
          COUNT(*) AS total,
          COUNT(r.id) AS answered,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.posted_at - v.posted_at)) / 3600.0)
            FILTER (WHERE r.posted_at IS NOT NULL) AS median_h
        FROM wj_review v
        LEFT JOIN wj_review_reply r ON r.review_id = v.id AND r.post_method <> 'EXTERNAL'
        WHERE v.property_id = ${pid} AND ${inRange(vDay)}
          AND NOT EXISTS (SELECT 1 FROM wj_review_reply x WHERE x.review_id = v.id AND x.post_method = 'EXTERNAL')
        GROUP BY 1`),
      this.prisma.$queryRaw<{ w: number; with_draft: bigint; as_is: bigint }[]>(Prisma.sql`
        SELECT ${bucket(rDay)}::int AS w,
          COUNT(*) FILTER (WHERE r.is_draft_edited IS NOT NULL) AS with_draft,
          COUNT(*) FILTER (WHERE r.is_draft_edited = false) AS as_is
        FROM wj_review_reply r JOIN wj_review v ON v.id = r.review_id
        WHERE v.property_id = ${pid} AND r.post_method <> 'EXTERNAL' AND r.posted_at IS NOT NULL AND ${inRange(rDay)}
        GROUP BY 1`),
      this.prisma.$queryRaw<
        { w: number; active_days: bigint; ledger_days: bigint; drafts: bigint; regen: bigint; posts: bigint }[]
      >(Prisma.sql`
        SELECT ${bucket(eDay)}::int AS w,
          COUNT(DISTINCT ${eDay}) FILTER (WHERE user_id IS NOT NULL) AS active_days,
          COUNT(DISTINCT ${eDay}) FILTER (WHERE event_kind IN ('LEDGER_VIEW', 'OVERVIEW_VIEW', 'REPORT_VIEW')) AS ledger_days,
          COUNT(*) FILTER (WHERE event_kind = 'DRAFT_CREATE' AND property_id = ${pid}) AS drafts,
          COUNT(*) FILTER (WHERE event_kind = 'DRAFT_REGENERATE' AND property_id = ${pid}) AS regen,
          COUNT(*) FILTER (WHERE event_kind = 'REPLY_POST' AND property_id = ${pid}) AS posts
        FROM wj_usage_event
        WHERE ${inRange(eDay)}
          AND (property_id = ${pid} OR (property_id IS NULL AND user_id IN ${userIds}))
        GROUP BY 1`),
      this.prisma.$queryRaw<{ w: number; total: bigint; digital: bigint }[]>(Prisma.sql`
        SELECT ${bucket(Prisma.raw('expense_date'))}::int AS w, COUNT(*) AS total,
          COUNT(*) FILTER (WHERE expense_source IN ('RECEIPT', 'CARD', 'ORDER')) AS digital
        FROM wj_expense WHERE property_id = ${pid} AND ${inRange(Prisma.raw('expense_date'))}
        GROUP BY 1`),
      this.prisma.$queryRaw<{ w: number; kind: string; count: bigint }[]>(Prisma.sql`
        SELECT ${bucket(KST_DAY('p.confirmed_at'))}::int AS w, 'confirmed' AS kind, COUNT(*) AS count
        FROM wj_payroll p JOIN wj_employee e ON e.id = p.employee_id
        WHERE e.property_id = ${pid} AND p.confirmed_at IS NOT NULL AND ${inRange(KST_DAY('p.confirmed_at'))}
        GROUP BY 1
        UNION ALL
        SELECT ${bucket(KST_DAY('p.sent_at'))}::int AS w, 'sent' AS kind, COUNT(*) AS count
        FROM wj_payroll p JOIN wj_employee e ON e.id = p.employee_id
        WHERE e.property_id = ${pid} AND p.sent_at IS NOT NULL AND ${inRange(KST_DAY('p.sent_at'))}
        GROUP BY 1`),
      this.prisma.$queryRaw<{ w: number; count: bigint }[]>(Prisma.sql`
        SELECT ${bucket(KST_DAY('c.signed_at'))}::int AS w, COUNT(*) AS count
        FROM wj_labor_contract c JOIN wj_employee e ON e.id = c.employee_id
        WHERE e.property_id = ${pid} AND c.signed_at IS NOT NULL AND ${inRange(KST_DAY('c.signed_at'))}
        GROUP BY 1`),
      this.prisma.$queryRaw<{ w: number; total: bigint; app: bigint }[]>(Prisma.sql`
        SELECT ${bucket(KST_DAY('a.clock_in_at'))}::int AS w, COUNT(*) AS total,
          COUNT(*) FILTER (WHERE a.clock_method <> 'MANUAL' AND a.edited_at IS NULL) AS app
        FROM wj_attendance a JOIN wj_employee e ON e.id = a.employee_id
        WHERE e.property_id = ${pid} AND ${inRange(KST_DAY('a.clock_in_at'))}
        GROUP BY 1`),
      // 주마다 채널별 마지막 평점 → 평균
      this.prisma.$queryRaw<{ w: number; rating: number | null; channels: bigint }[]>(Prisma.sql`
        SELECT w, AVG(rating)::float AS rating, COUNT(*) AS channels FROM (
          SELECT DISTINCT ON (channel_code, w) w, rating FROM (
            SELECT ${bucket(Prisma.raw('snapshot_date'))}::int AS w, channel_code, rating, snapshot_date
            FROM wj_rating_snapshot
            WHERE property_id = ${pid} AND ${inRange(Prisma.raw('snapshot_date'))}
          ) s
          ORDER BY channel_code, w, snapshot_date DESC
        ) t GROUP BY w`),
    ]);

    const at = <T extends { w: number }>(rows: T[], w: number) => rows.find((r) => Number(r.w) === w);
    const baselineRating = at(ratings, 0)?.rating ?? null;
    return Array.from({ length: PILOT_WEEKS + 1 }, (_, w) => {
      const wFrom = w === 0 ? addDaysIso(start, -PILOT_BASELINE_DAYS) : addDaysIso(start, (w - 1) * 7);
      const wTo = w === 0 ? addDaysIso(start, -1) : addDaysIso(start, w * 7 - 1);
      const future = wFrom > today;
      const days = future ? 0 : daysBetween(wFrom, wTo < today ? wTo : today) + 1;
      const rv = at(reviews, w);
      const rp = at(replies, w);
      const us = at(usage, w);
      const ex = at(expenses, w);
      const att = at(attendance, w);
      const rt = at(ratings, w);
      const payrollN = (k: string) => n(payroll.find((r) => Number(r.w) === w && r.kind === k)?.count);
      const ratingNow = rt?.rating == null ? null : Math.round(rt.rating * 100) / 100;
      if (future) return { week: w, from: wFrom, to: wTo, days: 0, partial: false, future: true } as const;
      return {
        week: w,
        from: wFrom,
        to: wTo,
        days,
        partial: days < (w === 0 ? PILOT_BASELINE_DAYS : 7),
        future: false,
        reviews: n(rv?.total),
        answered: n(rv?.answered),
        responseRate: rate(n(rv?.answered), n(rv?.total)),
        medianResponseHours: rv?.median_h == null ? null : Math.round(Number(rv.median_h) * 10) / 10,
        repliesWithDraft: n(rp?.with_draft),
        draftAsIs: n(rp?.as_is),
        draftAsIsRate: rate(n(rp?.as_is), n(rp?.with_draft)),
        activeDays: n(us?.active_days),
        ledgerDays: n(us?.ledger_days),
        expenses: n(ex?.total),
        digitalExpenses: n(ex?.digital),
        expenseDigitalRate: rate(n(ex?.digital), n(ex?.total)),
        payrollConfirmed: payrollN('confirmed'),
        payslipsSent: payrollN('sent'),
        contractsSigned: n(at(contracts, w)?.count),
        attendance: n(att?.total),
        attendanceApp: n(att?.app),
        attendanceAppRate: rate(n(att?.app), n(att?.total)),
        rating: ratingNow,
        ratingDelta:
          w > 0 && ratingNow != null && baselineRating != null
            ? Math.round((ratingNow - baselineRating) * 100) / 100
            : null,
        aiDrafts: n(us?.drafts),
        aiRegenerations: n(us?.regen),
        aiPosts: n(us?.posts),
      };
    });
  }

  private async ensureProperty(id: string) {
    const p = await this.prisma.property.findUnique({ where: { id }, select: { id: true } });
    if (!p) throw Errors.notFound('업장');
  }
}

function daysBetween(a: string, b: string) {
  return Math.round((dateOnly(b).getTime() - dateOnly(a).getTime()) / 86_400_000);
}

function latest(list: (Date | null)[]): Date | null {
  const t = Math.max(0, ...list.map((d) => d?.getTime() ?? 0));
  return t > 0 ? new Date(t) : null;
}

type NoteRow = Prisma.SupportNoteGetPayload<{ include: { admin: { select: { id: true; name: true } } } }>;
function toNote(r: NoteRow) {
  return { id: r.id, kind: r.kind, body: r.body, createdAt: r.createdAt, admin: r.admin };
}

type SurveyRow = Prisma.PilotSurveyGetPayload<object>;
export function toSurvey(r: SurveyRow) {
  const { propertyId: _p, updatedById: _u, ...rest } = r;
  return rest;
}
