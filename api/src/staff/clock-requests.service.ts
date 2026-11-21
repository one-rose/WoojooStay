import { Injectable } from '@nestjs/common';
import { Errors } from '../common/errors/app-error.js';
import { dateOnly, isoDay, kstDate } from '../common/utils/dates.js';
import { Prisma, type ClockRequest } from '../generated/prisma/client.js';
import type { Role } from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClockService } from './clock.service.js';
import type { ClockRequestDto } from './staff.dto.js';
import { OPEN_SHIFT_HOURS, StaffService } from './staff.service.js';

/** 요청 시각은 지금부터 이만큼 전까지 (출근을 깜빡하고 나중에 보내는 경우) */
export const REQUEST_LOOKBACK_HOURS = 12;
/** 휴대폰 시계가 조금 빠른 것은 봐준다 */
const CLOCK_SKEW_MS = 2 * 60_000;
const hhmm = (d: Date) => new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(11, 16);
const mdhm = (d: Date) => {
  const day = kstDate(d);
  return `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일 ${hhmm(d)}`;
};
const LABEL = { IN: '출근', OUT: '퇴근' } as const;
type Actor = { userId: string; role: Role };

/**
 * 출퇴근 요청 — 위치·QR 로 확인이 안 될 때 직원이 사유를 쓰고 보내면, 사장님·매니저가 승인(요청 시각으로 기록)하거나
 * 사유를 적어 거절한다. 보내면 사장님·매니저에게, 처리하면 직원에게 앱 알림 + 앱 푸시.
 */
@Injectable()
export class ClockRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staff: StaffService,
    private readonly clock: ClockService,
    private readonly notifications: NotificationsService,
  ) {}

  private view(r: ClockRequest & { employee?: { name: string }; decidedByName?: string | null }) {
    return {
      id: r.id,
      employeeId: r.employeeId,
      ...(r.employee ? { name: r.employee.name } : {}),
      type: r.type,
      status: r.status,
      requestedAt: r.requestedAt.toISOString(),
      /** 요청 시각 (한국 날짜 · HH:mm) */
      date: kstDate(r.requestedAt),
      time: hhmm(r.requestedAt),
      reason: r.reason,
      /** 요청할 때 업장까지 거리 (m) — 업장 위치와 요청 위치가 모두 있을 때만 */
      distanceM: r.distanceM,
      accuracyM: r.accuracyM,
      rejectReason: r.rejectReason,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      ...(r.decidedByName !== undefined ? { decidedBy: r.decidedByName } : {}),
      attendanceId: r.attendanceId,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private async pending(employeeId: string, type: 'IN' | 'OUT') {
    return this.prisma.clockRequest.findFirst({ where: { employeeId, type, status: 'PENDING' } });
  }

  /** 출근: 그날 이미 기록이 있거나 그 시각에 열린 근무가 있으면 안 된다 */
  private async ensureCanClockIn(propertyId: string, employeeId: string, at: Date) {
    const workDate = kstDate(at);
    await this.staff.ensureNotLocked(propertyId, workDate.slice(0, 7));
    const [exists, open] = await Promise.all([
      this.prisma.attendance.findUnique({
        where: { employeeId_workDate: { employeeId, workDate: dateOnly(workDate) } },
      }),
      this.staff.openShift(employeeId, at),
    ]);
    if (exists || open) throw Errors.alreadyClockedIn();
  }

  /** 퇴근: 그 시각에 열린 근무(16시간 안 출근)가 있어야 한다 */
  private async openFor(propertyId: string, employeeId: string, at: Date) {
    const open = await this.staff.openShift(employeeId, at);
    if (!open) return null;
    if (open.clockInAt.getTime() >= at.getTime())
      throw Errors.validation('퇴근 시각이 출근 시각보다 빨라요. 시각을 다시 확인해 주세요.');
    await this.staff.ensureNotLocked(propertyId, isoDay(open.workDate).slice(0, 7));
    return open;
  }

  /** 직원 본인이 보낸다 — 같은 종류(출근·퇴근)의 기다리는 요청이 있으면 409 */
  async create(propertyId: string, userId: string, dto: ClockRequestDto, now = new Date()) {
    const e = await this.staff.selfEmployee(propertyId, userId);
    const at = dto.requestedAt ? new Date(dto.requestedAt) : now;
    if (
      at.getTime() > now.getTime() + CLOCK_SKEW_MS ||
      at.getTime() < now.getTime() - REQUEST_LOOKBACK_HOURS * 3_600_000
    )
      throw Errors.requestedAtInvalid(REQUEST_LOOKBACK_HOURS);
    if (await this.pending(e.id, dto.type)) throw Errors.clockRequestPending(dto.type);
    if (dto.type === 'IN') await this.ensureCanClockIn(propertyId, e.id, at);
    else {
      const open = await this.openFor(propertyId, e.id, at);
      // 출근 요청이 아직 승인 전이면 퇴근 요청도 미리 보낼 수 있다 (승인은 출근부터)
      if (!open && !(await this.pending(e.id, 'IN'))) throw Errors.notClockedIn();
    }
    const p = await this.clock.property(propertyId);
    const r = await this.prisma.clockRequest.create({
      data: {
        propertyId,
        employeeId: e.id,
        type: dto.type,
        requestedAt: at,
        reason: dto.reason,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        accuracyM: dto.accuracy !== undefined ? Math.round(dto.accuracy) : null,
        distanceM: this.clock.measure(p, dto),
      },
    });
    await this.notifications.notifyProperty(
      propertyId,
      'STAFF',
      `${e.name}님이 ${LABEL[dto.type]} 요청을 보냈어요 (${hhmm(at)}). 사유: ${dto.reason}`,
      '/app/staff?tab=attendance',
      { excludeUserIds: [userId] },
    );
    return this.view(r);
  }

  /** 직원 본인 — 최근 30일 요청 (새 순) */
  async mine(propertyId: string, userId: string, now = new Date()) {
    const e = await this.staff.selfEmployee(propertyId, userId);
    const rows = await this.prisma.clockRequest.findMany({
      where: { employeeId: e.id, createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return { items: rows.map((r) => this.view(r)) };
  }

  /** 사장님·매니저 — 기본은 기다리는 요청 (오래된 순), 처리한 것은 최근 순 50건 */
  async list(propertyId: string, status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL' = 'PENDING') {
    const rows = await this.prisma.clockRequest.findMany({
      where: { propertyId, ...(status === 'ALL' ? {} : { status }) },
      include: { employee: { select: { name: true } } },
      orderBy: status === 'PENDING' ? { requestedAt: 'asc' } : { createdAt: 'desc' },
      take: status === 'PENDING' ? 100 : 50,
    });
    const deciders = [...new Set(rows.map((r) => r.decidedById).filter((x): x is string => !!x))];
    const users = deciders.length
      ? await this.prisma.user.findMany({ where: { id: { in: deciders } }, select: { id: true, name: true } })
      : [];
    const pendingCount =
      status === 'PENDING'
        ? rows.length
        : await this.prisma.clockRequest.count({ where: { propertyId, status: 'PENDING' } });
    return {
      pending: pendingCount,
      items: rows.map((r) =>
        this.view({
          ...r,
          decidedByName: r.decidedById ? (users.find((u) => u.id === r.decidedById)?.name ?? null) : null,
        }),
      ),
    };
  }

  private async load(propertyId: string, actor: Actor, id: string) {
    const r = await this.prisma.clockRequest.findFirst({ where: { id, propertyId } });
    if (!r) throw Errors.notFound('출퇴근 요청');
    if (r.status !== 'PENDING') throw Errors.clockRequestDecided();
    const e = await this.staff.findEmployee(propertyId, r.employeeId);
    // 매니저는 자기 요청을 처리할 수 없다 (자기 출퇴근 기록은 사장님만 고친다)
    if (actor.role === 'MANAGER' && e.userId === actor.userId) throw Errors.selfEditForbidden();
    return { r, e };
  }

  /** 승인 — 출근: 요청 시각으로 출근 기록(REQUEST) · 퇴근: 열린 근무에 요청 시각으로 퇴근. 급여 확정된 달은 안 된다 */
  async approve(propertyId: string, actor: Actor, id: string) {
    const { r, e } = await this.load(propertyId, actor, id);
    const decided = { status: 'APPROVED' as const, decidedById: actor.userId, decidedAt: new Date() };
    let attendanceId: string;
    if (r.type === 'IN') {
      const workDate = kstDate(r.requestedAt);
      if (dateOnly(workDate) < e.hiredDate) throw Errors.workDateBeforeHired();
      await this.ensureCanClockIn(propertyId, e.id, r.requestedAt);
      try {
        attendanceId = await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.clockRequest.updateMany({ where: { id, status: 'PENDING' }, data: decided });
          if (claimed.count === 0) throw Errors.clockRequestDecided();
          const a = await tx.attendance.create({
            data: {
              employeeId: e.id,
              workDate: dateOnly(workDate),
              clockInAt: r.requestedAt,
              method: 'REQUEST',
              inDistanceM: r.distanceM,
            },
          });
          await tx.clockRequest.update({ where: { id }, data: { attendanceId: a.id } });
          return a.id;
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
          throw Errors.alreadyClockedIn();
        throw err;
      }
    } else {
      const open = await this.openFor(propertyId, e.id, r.requestedAt);
      if (!open) {
        if (await this.pending(e.id, 'IN')) throw Errors.clockInPending();
        throw Errors.notClockedIn();
      }
      if (r.requestedAt.getTime() - open.clockInAt.getTime() > OPEN_SHIFT_HOURS * 3_600_000)
        throw Errors.shiftTooLong(OPEN_SHIFT_HOURS);
      attendanceId = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.clockRequest.updateMany({ where: { id, status: 'PENDING' }, data: decided });
        if (claimed.count === 0) throw Errors.clockRequestDecided();
        const closed = await tx.attendance.updateMany({
          where: { id: open.id, clockOutAt: null },
          data: { clockOutAt: r.requestedAt, outMethod: 'REQUEST', outDistanceM: r.distanceM },
        });
        if (closed.count === 0) throw Errors.notClockedIn();
        await tx.clockRequest.update({ where: { id }, data: { attendanceId: open.id } });
        return open.id;
      });
    }
    if (e.userId)
      await this.notifications.notifyUser(
        e.userId,
        propertyId,
        'STAFF',
        `${LABEL[r.type]} 요청이 승인됐어요. ${mdhm(r.requestedAt)} ${LABEL[r.type]}으로 기록했어요.`,
        '/app/me',
      );
    const row = await this.prisma.clockRequest.findUniqueOrThrow({ where: { id } });
    return {
      ...this.view(row),
      attendance: await this.prisma.attendance.findUniqueOrThrow({ where: { id: attendanceId } }),
    };
  }

  /** 거절 — 사유 필수. 출퇴근 기록은 바꾸지 않는다 */
  async reject(propertyId: string, actor: Actor, id: string, reason: string) {
    const { r, e } = await this.load(propertyId, actor, id);
    const claimed = await this.prisma.clockRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', decidedById: actor.userId, decidedAt: new Date(), rejectReason: reason },
    });
    if (claimed.count === 0) throw Errors.clockRequestDecided();
    if (e.userId)
      await this.notifications.notifyUser(
        e.userId,
        propertyId,
        'STAFF',
        `${mdhm(r.requestedAt)} ${LABEL[r.type]} 요청이 거절됐어요. 사유: ${reason}`,
        '/app/me',
      );
    return this.view(await this.prisma.clockRequest.findUniqueOrThrow({ where: { id } }));
  }
}
