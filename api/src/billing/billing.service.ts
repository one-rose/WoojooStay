import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Errors } from '../common/errors/app-error.js';
import { addDaysIso, dateOnly, isoDay, kstDate, monthStart } from '../common/utils/dates.js';
import type { Env } from '../config/env.js';
import { CredentialVault } from '../connectors/credential-vault.js';
import type { NotificationKind, PlanCode } from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentGateway } from './payment-gateway.js';

const NOTICE_KINDS: NotificationKind[] = ['REVIEW', 'SETTLE', 'SYNC', 'BILLING', 'STAFF'];
const won = (n: number) => n.toLocaleString('ko-KR');

/** 결제일 = 무료 체험이 끝나는 날의 '일' (29~31일은 28일로) */
function billingDay(trialEnd: string) {
  return Math.min(Number(trialEnd.slice(8, 10)), 28);
}

/**
 * PG 주문번호 = 멱등 키. 업장·달·종류(M 정기 / 상품 코드 즉시)·시도 순번으로 정해진다.
 * 서버가 결제 직후 죽어 다시 시도해도 같은 번호가 나가므로 PG 가 두 번 승인하지 않는다.
 * 토스 orderId 규칙: 6~64자 [A-Za-z0-9_=-]
 */
export function billingOrderPrefix(propertyId: string, month: string, kind: string) {
  return `wj-${propertyId.replace(/-/g, '')}-${month.replace('-', '')}-${kind}-`;
}

/** 구독 (F0-08) · 결제 (F0-09) · 알림 설정 (F0-13) */
@Injectable()
export class BillingService {
  private readonly logger = new Logger('Billing');

  constructor(
    private readonly prisma: PrismaService,
    private readonly pg: PaymentGateway,
    private readonly vault: CredentialVault,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** 새 업장 무료 체험 일수 (TRIAL_DAYS, 기본 30) */
  get trialDays(): number {
    return this.config.get('TRIAL_DAYS', { infer: true }) ?? 30;
  }

  /** 같은 업장의 결제 작업은 한 번에 하나씩 (카드 등록·정기결제·서비스 켜기가 겹쳐도 두 번 결제하지 않게) */
  private locked<T>(propertyId: string, fn: () => Promise<T>) {
    return this.prisma.withLock(`billing:${propertyId}`, fn);
  }

  plans() {
    return this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  /** 업장 등록할 때 — 핵심 두 서비스 무료 체험 */
  async startTrial(propertyId: string, today = kstDate()) {
    const trialEndsAt = dateOnly(addDaysIso(today, this.trialDays));
    await this.prisma.subscription.createMany({
      data: (['REVIEW', 'LEDGER'] as PlanCode[]).map((planCode) => ({ propertyId, planCode, trialEndsAt })),
      skipDuplicates: true,
    });
  }

  private async trialEnd(propertyId: string) {
    const first = await this.prisma.subscription.findFirst({
      where: { propertyId },
      orderBy: { trialEndsAt: 'asc' },
    });
    return first ? isoDay(first.trialEndsAt) : null;
  }

  private nextBilling(trialEnd: string, today: string) {
    if (today < trialEnd) return trialEnd;
    const day = String(billingDay(trialEnd)).padStart(2, '0');
    const thisMonth = `${today.slice(0, 7)}-${day}`;
    if (today < thisMonth) return thisMonth;
    const d = dateOnly(thisMonth);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return isoDay(d);
  }

  async billing(propertyId: string, today = kstDate()) {
    const [plans, subs, card, payments, trialEnd] = await Promise.all([
      this.plans(),
      this.prisma.subscription.findMany({ where: { propertyId } }),
      this.prisma.paymentMethod.findFirst({ where: { propertyId, isDefault: true } }),
      this.prisma.payment.findMany({ where: { propertyId }, orderBy: { paidAt: 'desc' }, take: 24 }),
      this.trialEnd(propertyId),
    ]);
    const live = subs.filter((s) => s.status !== 'CANCELLED');
    return {
      plans: plans.map((p) => ({
        code: p.code,
        name: p.name,
        monthlyPrice: p.monthlyPrice,
        description: p.description,
        stage: p.stageLabel,
        available: p.isAvailable,
      })),
      subscriptions: subs.map((s) => ({
        planCode: s.planCode,
        status: s.status,
        trialEndsAt: isoDay(s.trialEndsAt),
        paidMonth: s.paidMonth ? isoDay(s.paidMonth).slice(0, 7) : null,
      })),
      subscribed: live.map((s) => s.planCode),
      trialEnds: trialEnd,
      inTrial: trialEnd !== null && today < trialEnd,
      nextBilling: trialEnd && live.length ? this.nextBilling(trialEnd, today) : null,
      monthlyTotal: live.reduce((sum, s) => sum + (plans.find((p) => p.code === s.planCode)?.monthlyPrice ?? 0), 0),
      card: card ? { name: card.cardName, last4: card.cardLast4 } : null,
      payments: payments.map((p) => ({
        id: p.id,
        date: p.paidAt,
        billedMonth: isoDay(p.billedMonth).slice(0, 7),
        description: p.description,
        amount: p.amount,
        status: p.status,
      })),
    };
  }

  /**
   * 서비스 켜기·끄기. 체험 기간이면 체험으로, 끝났으면 바로 결제.
   * 이번 달 요금을 이미 낸 구독을 껐다 다시 켜면 또 결제하지 않는다.
   */
  async setPlan(propertyId: string, planCode: PlanCode, enabled: boolean, today = kstDate()) {
    const plan = await this.prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan) throw Errors.notFound('상품');
    if (enabled && !plan.isAvailable) throw Errors.planUnavailable();
    const month = today.slice(0, 7);
    await this.locked(propertyId, async () => {
      // 잠금 안에서 다시 읽는다
      const existing = await this.prisma.subscription.findUnique({
        where: { propertyId_planCode: { propertyId, planCode } },
      });
      if (!enabled) {
        if (existing && existing.status !== 'CANCELLED')
          await this.prisma.subscription.update({
            where: { id: existing.id },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          });
        return;
      }
      if (existing && existing.status !== 'CANCELLED') return;

      const trialEnd = (await this.trialEnd(propertyId)) ?? addDaysIso(today, this.trialDays);
      if (today < trialEnd) {
        await this.prisma.subscription.upsert({
          where: { propertyId_planCode: { propertyId, planCode } },
          create: { propertyId, planCode, trialEndsAt: dateOnly(trialEnd) },
          update: { status: 'TRIAL', trialEndsAt: dateOnly(trialEnd), cancelledAt: null },
        });
        return;
      }
      const paidThisMonth = existing?.paidMonth && isoDay(existing.paidMonth).startsWith(month);
      if (!paidThisMonth) {
        // 체험 끝난 뒤 새로 켜면 이번 달 요금을 바로 결제
        const charged = await this.chargeNow(propertyId, plan.monthlyPrice, `${plan.name} 구독`, today, planCode);
        if (!charged.ok) throw Errors.paymentFailed(charged.reason);
      }
      await this.prisma.subscription.upsert({
        where: { propertyId_planCode: { propertyId, planCode } },
        create: {
          propertyId,
          planCode,
          trialEndsAt: dateOnly(trialEnd),
          status: 'ACTIVE',
          paidMonth: monthStart(month),
        },
        update: { status: 'ACTIVE', cancelledAt: null, paidMonth: monthStart(month) },
      });
    });
    return this.billing(propertyId, today);
  }

  async setCard(propertyId: string, authKey: string, today = kstDate()) {
    let card;
    try {
      card = await this.pg.issueBillingKey(authKey, propertyId);
    } catch {
      throw Errors.cardFailed();
    }
    await this.locked(propertyId, async () => {
      await this.prisma.$transaction([
        this.prisma.paymentMethod.updateMany({ where: { propertyId }, data: { isDefault: false } }),
        this.prisma.paymentMethod.create({
          data: {
            propertyId,
            cardName: card.cardName,
            cardLast4: card.last4,
            billingKey: this.vault.sealText(card.billingKey),
          },
        }),
      ]);
      // 결제 실패 상태였다면 새 카드로 바로 다시 결제 (동시에 카드를 여러 번 등록해도 잠금 안에서 다시 세므로 한 번만)
      const pastDue = await this.prisma.subscription.count({ where: { propertyId, status: 'PAST_DUE' } });
      if (pastDue > 0) await this.billUnlocked(propertyId, today, true);
    });
    return this.billing(propertyId, today);
  }

  private async chargeNow(propertyId: string, amount: number, description: string, today: string, kind: string) {
    const method = await this.prisma.paymentMethod.findFirst({ where: { propertyId, isDefault: true } });
    if (!method) return { ok: false as const, reason: '등록된 결제 카드가 없어요.' };
    const month = today.slice(0, 7);
    const prefix = billingOrderPrefix(propertyId, month, kind);
    const attempt = (await this.prisma.payment.count({ where: { propertyId, orderNo: { startsWith: prefix } } })) + 1;
    const orderNo = `${prefix}${attempt}`;
    const r = await this.pg.charge(this.vault.openText(method.billingKey), amount, description, propertyId, orderNo);
    await this.prisma.payment.create({
      data: {
        propertyId,
        billedMonth: monthStart(month),
        description,
        amount,
        status: r.ok ? 'PAID' : 'FAILED',
        orderNo,
      },
    });
    return r;
  }

  /**
   * 한 업장 정기결제. 체험이 끝났거나 결제 실패 상태인 구독 중 이번 달 아직 안 낸 것을 묶어 한 번에 결제.
   * 성공 → 정상(ACTIVE) + 이번 달 결제 완료 표시, 실패 → 결제 실패(PAST_DUE) + 사장님 알림
   */
  async billProperty(propertyId: string, today: string, force = false) {
    return this.locked(propertyId, () => this.billUnlocked(propertyId, today, force));
  }

  private async billUnlocked(propertyId: string, today: string, force: boolean) {
    const month = today.slice(0, 7);
    const subs = await this.prisma.subscription.findMany({
      where: { propertyId, status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] } },
      include: { plan: true },
    });
    if (subs.length === 0) return null;
    const paid = (s: (typeof subs)[number]) => !!s.paidMonth && isoDay(s.paidMonth).startsWith(month);
    // 구독마다 이번 달 결제 여부를 본다 (다른 구독을 이번 달 먼저 결제했어도 빠뜨리지 않는다)
    const due = subs.filter((s) => (s.status === 'PAST_DUE' || isoDay(s.trialEndsAt) <= today) && !paid(s));
    if (due.length === 0) return null;
    const trialEnd = isoDay(subs.reduce((a, b) => (a.trialEndsAt < b.trialEndsAt ? a : b)).trialEndsAt);
    const isBillingDay = Number(today.slice(8, 10)) >= billingDay(trialEnd) || today === trialEnd;
    if (!force && !isBillingDay) return null;
    const amount = due.reduce((s, x) => s + x.plan.monthlyPrice, 0);
    const description = `${month.replace('-', '년 ')}월 구독 (${due.map((s) => s.plan.name).join(', ')})`;
    const r = amount > 0 ? await this.chargeNow(propertyId, amount, description, today, 'M') : ({ ok: true } as const);
    await this.prisma.subscription.updateMany({
      where: { id: { in: due.map((s) => s.id) } },
      data: r.ok ? { status: 'ACTIVE', paidMonth: monthStart(month) } : { status: 'PAST_DUE' },
    });
    if (!r.ok) {
      await this.notifications.notifyProperty(
        propertyId,
        'BILLING',
        `구독료 ${won(amount)}원 결제에 실패했어요. ${r.reason} 결제 카드를 확인해 주세요.`,
        '/app/settings/billing',
      );
    }
    return { amount, ok: r.ok };
  }

  /** 매일 한 번 — 모든 업장 정기결제 */
  async runDaily(today = kstDate()) {
    const properties = await this.prisma.subscription.findMany({
      where: { status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] }, trialEndsAt: { lte: dateOnly(today) } },
      distinct: ['propertyId'],
      select: { propertyId: true },
    });
    let charged = 0;
    for (const { propertyId } of properties) {
      try {
        if (await this.billProperty(propertyId, today)) charged += 1;
      } catch (err) {
        this.logger.error(`정기결제 실패 ${propertyId}: ${(err as Error).message}`);
      }
    }
    return { properties: properties.length, charged };
  }

  // ─── F0-13 알림 받기 설정 ─────────────────────────────
  async noticeSettings(userId: string, propertyId: string) {
    const rows = await this.prisma.notificationSetting.findMany({ where: { userId, propertyId } });
    return NOTICE_KINDS.map((kind) => {
      const r = rows.find((x) => x.kind === kind);
      return { kind, alimtalk: r?.alimtalk ?? true, push: r?.push ?? true, email: r?.email ?? false };
    });
  }

  async setNoticeSettings(
    userId: string,
    propertyId: string,
    items: { kind: NotificationKind; alimtalk: boolean; push: boolean; email: boolean }[],
  ) {
    for (const i of items) {
      const data = { alimtalk: i.alimtalk, push: i.push, email: i.email };
      await this.prisma.notificationSetting.upsert({
        where: { userId_propertyId_kind: { userId, propertyId, kind: i.kind } },
        create: { userId, propertyId, kind: i.kind, ...data },
        update: data,
      });
    }
    return this.noticeSettings(userId, propertyId);
  }
}
