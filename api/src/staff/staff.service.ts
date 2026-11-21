import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Errors } from '../common/errors/app-error.js';
import { addDaysIso, addMonths, dateOnly, isoDay, kstDate, kstHour, monthStart } from '../common/utils/dates.js';
import { randomToken, sha256 } from '../common/utils/crypto.js';
import { exposeDevSecrets, webOrigin, type Env } from '../config/env.js';
import { Prisma, type Employee, type Payroll } from '../generated/prisma/client.js';
import type { PayType, Role, ShiftType } from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmsSender } from '../sms/sms-sender.js';
import { SmsQuota, smsSafeName } from '../sms/sms-quota.js';
import { ClockService, type ClockEvidence, type PresenceCheck } from './clock.service.js';
import {
  computeMonthlyPay,
  currentMinimumWage,
  isBelowMinimumWage,
  minimumWageFor,
  monthWeekRange,
  sumHours,
  weekMonday,
} from './payroll.js';
import type { EditAttendanceDto, EmployeeDto, UpdateEmployeeDto } from './staff.dto.js';

const KST_OFFSET = '+09:00';
const won = (n: number) => n.toLocaleString('ko-KR');
const hhmm = (d: Date) => new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(11, 16);
const atKst = (date: string, time: string) => new Date(`${date}T${time}:00${KST_OFFSET}`);
const CONTRACT_DAYS = 7;
/** 출근 후 이 시간이 지나도 퇴근 기록이 없으면 '퇴근 누락'으로 보고, 지금 근무 중으로 치지 않는다 */
export const OPEN_SHIFT_HOURS = 16;
const openSince = (now = new Date()) => new Date(now.getTime() - OPEN_SHIFT_HOURS * 3_600_000);
/** 퇴근을 누른 뒤 이 시간 안에는 본인이 되돌릴 수 있다 (P-12) */
export const UNDO_OUT_MS = 5 * 60_000;
/** 퇴근 누락을 찾는 기간 — 전체 현황(/portfolio)과 같게 */
export const MISSING_LOOKBACK_DAYS = 31;
/** 근무 시작 시각 (KST 시) — 이 시각 전이면 '근무 예정', 지나도 출근이 없으면 '지각' */
const SHIFT_START_HOUR: Record<'DAY' | 'NIGHT', number> = { DAY: 9, NIGHT: 22 };
/** 그 날 재직 중인지 — 퇴사일 당일까지는 재직 */
const employedOn = (iso: string) => ({ OR: [{ resignedAt: null }, { resignedAt: { gte: dateOnly(iso) } }] });
type AttendanceRow = { employeeId: string; workDate: Date; clockInAt: Date; clockOutAt: Date | null };
type Actor = { userId: string; role: Role };

/** 알바관리 (F5-01 직원 · F5-02 출퇴근 · F5-03 근무표 · F5-04 급여 · F5-06 근로계약서) */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsSender,
    private readonly quota: SmsQuota,
    private readonly config: ConfigService<Env, true>,
    private readonly notifications: NotificationsService,
    private readonly clockCheck: ClockService,
  ) {}

  private async employee(propertyId: string, id: string) {
    const e = await this.prisma.employee.findFirst({ where: { id, propertyId } });
    if (!e) throw Errors.notFound('직원');
    return e;
  }

  /**
   * 화면 한 장 — 직원·오늘 출퇴근·이번 주 근무표·이번 달 급여.
   * week('YYYY-MM-DD', 그 주의 아무 날 — 보통 월요일)를 주면 근무표는 그 주로 (교대표 주 이동).
   */
  async overview(propertyId: string, date = kstDate(), week?: string) {
    const month = date.slice(0, 7);
    const monday = weekMonday(week ?? date);
    const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
    const today = kstDate();
    const members = await this.prisma.employee.findMany({
      where: {
        propertyId,
        OR: [{ resignedAt: null }, { resignedAt: { gte: monthStart(month) } }],
      },
      orderBy: [{ hiredDate: 'asc' }, { name: 'asc' }],
      include: { contracts: { orderBy: { sentAt: 'desc' }, take: 1 } },
    });
    const ids = members.map((m) => m.id);
    const [dayRows, overnight, monthRows, shifts, todayShifts, saved, missing, requests] = await Promise.all([
      this.prisma.attendance.findMany({ where: { employeeId: { in: ids }, workDate: dateOnly(date) } }),
      // 어젯밤 출근해 자정을 넘겨 아직 근무 중인 기록 (16시간 안)
      date === today
        ? this.prisma.attendance.findMany({
            where: {
              employeeId: { in: ids },
              workDate: dateOnly(addDaysIso(date, -1)),
              clockOutAt: null,
              clockInAt: { gt: openSince() },
            },
          })
        : Promise.resolve([]),
      this.payrollRows(ids, month),
      this.prisma.workShift.findMany({
        where: { employeeId: { in: ids }, workDate: { gte: dateOnly(weekDates[0]), lte: dateOnly(weekDates[6]) } },
      }),
      this.prisma.workShift.findMany({ where: { employeeId: { in: ids }, workDate: dateOnly(date) } }),
      this.prisma.payroll.findMany({ where: { employeeId: { in: ids }, month: monthStart(month) } }),
      this.missingClockOuts(propertyId),
      this.prisma.clockRequest.findMany({
        where: { propertyId, status: 'PENDING' },
        include: { employee: { select: { name: true } } },
        orderBy: { requestedAt: 'asc' },
        take: 100,
      }),
    ]);

    const isToday = date === today;
    const stale = openSince();
    const hour = kstHour();
    const todayShift = (id: string) => todayShifts.find((s) => s.employeeId === id)?.shiftType;

    return {
      date,
      month,
      /** 이 달(month)의 해 최저시급 */
      minimumWage: minimumWageFor(month),
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        phone: m.phone,
        jobRole: m.jobRole,
        payType: m.payType,
        payAmount: m.payAmount,
        hiredDate: isoDay(m.hiredDate),
        resignedDate: m.resignedAt ? isoDay(m.resignedAt) : null,
        contract: m.contracts[0]?.status ?? null,
        linked: m.userId !== null,
      })),
      /**
       * 오늘 상태 — working 근무 중(어젯밤부터 이어진 야간 포함) · done 퇴근 · missing-out 퇴근 누락 ·
       * late 시작 시각이 지났는데 출근 없음 · scheduled 오늘 근무인데 아직 시작 전 · off 휴무(근무표 없음)
       */
      today: members.map((m) => {
        const a = dayRows.find((x) => x.employeeId === m.id) ?? overnight.find((x) => x.employeeId === m.id);
        const shift = todayShift(m.id);
        let status: 'working' | 'done' | 'missing-out' | 'late' | 'scheduled' | 'off';
        if (a) status = a.clockOutAt ? 'done' : isToday && a.clockInAt > stale ? 'working' : 'missing-out';
        else if (shift === 'DAY' || shift === 'NIGHT')
          status = !isToday || hour >= SHIFT_START_HOUR[shift] ? 'late' : 'scheduled';
        else status = 'off';
        return {
          employeeId: m.id,
          attendanceId: a?.id ?? null,
          in: a ? hhmm(a.clockInAt) : null,
          out: a?.clockOutAt ? hhmm(a.clockOutAt) : null,
          status,
          edited: Boolean(a?.editedAt),
          /** 출근을 어떻게 찍었는지 GPS 위치 · QR · REQUEST 요청 승인 · MANUAL 수기 (기록 없으면 null) */
          method: a?.method ?? null,
          outMethod: a?.outMethod ?? null,
        };
      }),
      monthHours: Object.fromEntries(
        members.map((m) => [
          m.id,
          sumHours(
            monthRows
              .filter((r) => r.employeeId === m.id && isoDay(r.workDate).startsWith(month))
              .map((r) => ({ ...r, workDate: isoDay(r.workDate) })),
          ).hours,
        ]),
      ),
      /** 근무표 — 근무표를 짜지 않은 날은 null (미정 · 휴무 OFF 와 다름) */
      week: {
        dates: weekDates,
        shifts: Object.fromEntries(
          members.map((m) => [
            m.id,
            weekDates.map(
              (d) => shifts.find((s) => s.employeeId === m.id && isoDay(s.workDate) === d)?.shiftType ?? null,
            ),
          ]),
        ),
      },
      payroll: members.map((m) => ({
        employeeId: m.id,
        ...this.payFor(
          m,
          month,
          monthRows,
          saved.find((p) => p.employeeId === m.id),
        ),
      })),
      /**
       * 퇴근 누락 — 출근 후 16시간 넘게 퇴근 기록이 없음 (최근 31일, 퇴사자 포함 · /portfolio 와 같은 기준).
       * 기록 수정(PUT attendance)으로 고친다
       */
      missingClockOut: missing.map((a) => ({
        employeeId: a.employeeId,
        name: a.employee.name,
        attendanceId: a.id,
        date: isoDay(a.workDate),
        in: hhmm(a.clockInAt),
      })),
      /** 기다리는 출퇴근 요청 (오래된 순) — 승인·거절은 /staff/clock-requests/:id/approve · reject */
      clockRequests: requests.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        name: r.employee.name,
        type: r.type,
        requestedAt: r.requestedAt.toISOString(),
        date: kstDate(r.requestedAt),
        time: hhmm(r.requestedAt),
        reason: r.reason,
        distanceM: r.distanceM,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /** 퇴근 누락 — 이 업장 직원(퇴사자 포함) 기록 중 퇴근 없이 16시간 넘게 열린 것 (최근 31일) */
  private missingClockOuts(propertyId: string, now = new Date()) {
    return this.prisma.attendance.findMany({
      where: {
        employee: { propertyId },
        clockOutAt: null,
        clockInAt: { lte: openSince(now) },
        workDate: { gte: dateOnly(addDaysIso(kstDate(now), -MISSING_LOOKBACK_DAYS)) },
      },
      include: { employee: { select: { name: true } } },
      orderBy: { workDate: 'desc' },
    });
  }

  /** 급여 계산용 출퇴근 — 그 달 첫 주 월요일 ~ 마지막 주 일요일 (주휴수당이 달을 넘는 주) */
  private payrollRows(employeeIds: string[], month: string) {
    const range = monthWeekRange(month);
    return this.prisma.attendance.findMany({
      where: { employeeId: { in: employeeIds }, workDate: { gte: dateOnly(range.from), lte: dateOnly(range.to) } },
    });
  }

  private calc(m: Employee, month: string, rows: AttendanceRow[]) {
    const r = computeMonthlyPay({
      month,
      payType: m.payType,
      payAmount: m.payAmount,
      hiredDate: isoDay(m.hiredDate),
      resignedDate: m.resignedAt ? isoDay(m.resignedAt) : null,
      shifts: rows.filter((x) => x.employeeId === m.id).map((x) => ({ ...x, workDate: isoDay(x.workDate) })),
    });
    return { hours: r.hours, nightHours: r.nightHours, base: r.base, night: r.night, weekly: r.weekly, total: r.total };
  }

  /**
   * 한 직원의 그 달 급여 — 확정·발송된 급여는 저장값, 확정 전(DRAFT)·계산 전은 출퇴근 기록으로 다시 계산.
   * 사장님 알바관리 급여 칸과 직원 본인 화면(/staff/me)이 같은 숫자를 보도록 둘 다 이것을 쓴다.
   */
  private payFor(m: Employee, month: string, rows: AttendanceRow[], row?: Payroll) {
    if (row && row.status !== 'DRAFT')
      return {
        hours: Number(row.workHours),
        nightHours: Number(row.nightHours),
        base: row.baseAmount,
        night: row.nightAmount,
        weekly: row.weeklyAmount,
        total: row.totalAmount,
        status: row.status,
      };
    return { ...this.calc(m, month, rows), status: row?.status ?? null };
  }

  /** 매니저는 자기 직원 기록(급여·출퇴근)을 고칠 수 없다 — 사장님만 */
  private guardSelfEdit(actor: Actor, e: Employee) {
    if (actor.role === 'MANAGER' && e.userId === actor.userId) throw Errors.selfEditForbidden();
  }

  /**
   * 직원 본인 화면 — 오늘 출퇴근 · 이번 주·다음 주 근무 · 오늘 같이 일하는 사람 · 이번 달 기록 · 급여 내역 (F5-02 직원 모바일).
   * 근무표가 없는 날은 null(미정). 급여 내역(pay)은 사장님 알바관리 급여 칸과 같은 계산(payFor)이다.
   */
  async mine(propertyId: string, userId: string, date = kstDate()) {
    const e = await this.prisma.employee.findFirst({
      where: { propertyId, userId, ...employedOn(kstDate()) },
      include: {
        property: { select: { name: true, latitude: true, longitude: true, clockRadiusM: true } },
        clockRequests: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!e) throw Errors.notLinkedEmployee();
    const month = date.slice(0, 7);
    const monday = weekMonday(date);
    const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
    const nextDates = weekDates.map((d) => addDaysIso(d, 7));
    const [allRows, shifts, open, saved, crew, crewShifts, crewRows, lastOut] = await Promise.all([
      this.payrollRows([e.id], month),
      this.prisma.workShift.findMany({
        where: { employeeId: e.id, workDate: { gte: dateOnly(weekDates[0]), lte: dateOnly(nextDates[6]) } },
      }),
      this.openShift(e.id),
      this.prisma.payroll.findUnique({ where: { employeeId_month: { employeeId: e.id, month: monthStart(month) } } }),
      this.prisma.employee.findMany({
        where: { propertyId, id: { not: e.id }, ...employedOn(date) },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.workShift.findMany({
        where: { employee: { propertyId }, employeeId: { not: e.id }, workDate: dateOnly(date) },
      }),
      this.prisma.attendance.findMany({
        where: { employee: { propertyId }, employeeId: { not: e.id }, workDate: dateOnly(date) },
      }),
      this.lastClockOut(e.id),
    ]);
    const rows = allRows
      .filter((r) => isoDay(r.workDate).startsWith(month))
      .sort((a, b) => b.workDate.getTime() - a.workDate.getTime());
    const today = rows.find((r) => isoDay(r.workDate) === date);
    const pay = this.payFor(e, month, allRows, saved ?? undefined);
    const shiftOn = (d: string) => shifts.find((s) => isoDay(s.workDate) === d)?.shiftType ?? null;
    const hourly = e.payType === 'HOURLY';
    const current = open ?? today;
    return {
      date,
      property: e.property.name,
      employee: { id: e.id, name: e.name, jobRole: e.jobRole, payType: e.payType, payAmount: e.payAmount },
      /** 지금 누를 버튼: 출근 / 퇴근 / 오늘 끝 */
      state: open ? 'working' : today ? 'done' : 'ready',
      today: {
        in: current ? hhmm(current.clockInAt) : null,
        out: today?.clockOutAt ? hhmm(today.clockOutAt) : null,
        /** null: 근무표 없음 (미정) */
        shift: shiftOn(date),
        /** 출근·퇴근을 어떻게 찍었는지 (GPS · QR · REQUEST · MANUAL) */
        method: current?.method ?? null,
        outMethod: today?.outMethod ?? null,
      },
      /**
       * 출근 확인 설정 — locationSet false 면 위치 확인 없이 찍힌다 (앱은 "사장님께 업장 위치 설정을 요청" 안내).
       * 위치(latitude·longitude·accuracy) 또는 QR 로 POST attendance/clock, 안 되면 POST clock-requests
       */
      clock: ClockService.settings(e.property),
      /** 최근 출퇴근 요청 5건 (새 순) — PENDING 이 있으면 같은 종류는 다시 보낼 수 없다 */
      requests: e.clockRequests.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        requestedAt: r.requestedAt.toISOString(),
        reason: r.reason,
        rejectReason: r.rejectReason,
        decidedAt: r.decidedAt?.toISOString() ?? null,
      })),
      /** 방금 퇴근했으면 되돌릴 수 있는 마감 시각 (퇴근 후 5분, 급여 확정 전) — 없으면 null */
      undoOutUntil: lastOut ? new Date(lastOut.clockOutAt!.getTime() + UNDO_OUT_MS).toISOString() : null,
      week: { dates: weekDates, shifts: weekDates.map(shiftOn) },
      nextWeek: { dates: nextDates, shifts: nextDates.map(shiftOn) },
      /**
       * 오늘 같이 일하는 사람 — 오늘 근무표가 낮·밤이거나 오늘 출근한 동료 (휴무·미정이면서 출근 안 한 사람은 빼고).
       * working: 지금 근무 중
       */
      coworkers: crew
        .map((c) => {
          const shift = crewShifts.find((s) => s.employeeId === c.id)?.shiftType ?? null;
          const a = crewRows.find((r) => r.employeeId === c.id);
          return {
            name: c.name,
            shift: shift === 'DAY' || shift === 'NIGHT' ? shift : null,
            working: !!a && !a.clockOutAt && a.clockInAt > openSince(),
            clockedIn: !!a,
          };
        })
        .filter((c) => c.shift !== null || c.clockedIn)
        .sort((a, b) => (a.shift ?? 'Z').localeCompare(b.shift ?? 'Z') || a.name.localeCompare(b.name))
        .map(({ clockedIn: _c, ...c }) => c),
      month: { hours: pay.hours, nightHours: pay.nightHours, estimatedPay: pay.total },
      /**
       * 이번 달 급여 내역 — 사장님 급여 화면과 같은 숫자. 시급제: 기본(시간×시급) + 야간 가산(50%) + 주휴.
       * 월급제는 rate·weeklyHours 가 null 이고 base 가 일할한 월급.
       */
      pay: {
        payType: e.payType,
        rate: hourly ? e.payAmount : null,
        monthly: hourly ? null : e.payAmount,
        hours: pay.hours,
        base: pay.base,
        nightHours: pay.nightHours,
        night: pay.night,
        weeklyHours: hourly && e.payAmount > 0 ? Math.round((pay.weekly / e.payAmount) * 10) / 10 : null,
        weekly: pay.weekly,
        total: pay.total,
        /** null 계산만 · DRAFT 확정 전 · CONFIRMED 확정 · SENT 명세 보냄 */
        status: pay.status,
      },
      records: rows.map((r) => ({
        date: isoDay(r.workDate),
        in: hhmm(r.clockInAt),
        out: r.clockOutAt ? hhmm(r.clockOutAt) : null,
        hours: r.clockOutAt
          ? Math.round(((r.clockOutAt.getTime() - r.clockInAt.getTime()) / 3_600_000) * 10) / 10
          : null,
        edited: r.editedAt !== null,
        method: r.method,
      })),
    };
  }

  /** 되돌릴 수 있는 마지막 퇴근 — 5분 안에 본인이 찍은 퇴근 (그 뒤 사장님·매니저가 고친 기록은 아님) */
  private lastClockOut(employeeId: string, now = new Date()) {
    return this.prisma.attendance.findFirst({
      where: {
        employeeId,
        clockOutAt: { gt: new Date(now.getTime() - UNDO_OUT_MS), lte: now },
        clockInAt: { gt: openSince(now) },
        editedAt: null,
      },
      orderBy: { clockOutAt: 'desc' },
    });
  }

  /**
   * 퇴근 되돌리기 (P-12) — 직원 본인이 잘못 누른 퇴근을 5분 안에 취소해 다시 근무 중으로.
   * 본인 직원 기록만, 그 달 급여가 확정됐으면 안 된다. 사장님·매니저가 고친 기록은 되돌리지 않는다.
   */
  async undoClockOut(propertyId: string, userId: string, now = new Date()) {
    const e = await this.prisma.employee.findFirst({ where: { propertyId, userId, ...employedOn(kstDate(now)) } });
    if (!e) throw Errors.notLinkedEmployee();
    const last = await this.lastClockOut(e.id, now);
    if (!last) throw Errors.undoExpired();
    await this.ensureNotLocked(propertyId, isoDay(last.workDate).slice(0, 7));
    // 그새 다른 근무가 열렸으면(다시 출근) 되돌리지 않는다
    if (await this.openShift(e.id)) throw Errors.alreadyClockedIn();
    const r = await this.prisma.attendance.updateMany({
      where: { id: last.id, clockOutAt: last.clockOutAt, editedAt: null },
      data: { clockOutAt: null, outMethod: null, outDistanceM: null },
    });
    if (r.count === 0) throw Errors.undoExpired();
    return this.prisma.attendance.findUniqueOrThrow({ where: { id: last.id } });
  }

  /**
   * 직원 한 명의 한 달 출퇴근 (P-11 '이번 달 기록') — 기록이 있거나 근무표상 근무(낮·밤)인 날.
   * missingOut: 퇴근 기록 없이 16시간 넘게 열림 · absent: 지난 근무일인데 기록 없음.
   * locked: 그 달 급여가 확정돼 고칠 수 없음.
   */
  async employeeAttendance(propertyId: string, employeeId: string, month: string, today = kstDate()) {
    if (month > today.slice(0, 7)) throw Errors.futureMonth();
    const e = await this.employee(propertyId, employeeId);
    const from = monthStart(month);
    const to = monthStart(addMonths(month, 1));
    const [rows, shifts, lockedCount] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { employeeId, workDate: { gte: from, lt: to } },
        orderBy: { workDate: 'asc' },
      }),
      this.prisma.workShift.findMany({ where: { employeeId, workDate: { gte: from, lt: to } } }),
      this.prisma.payroll.count({
        where: { month: from, status: { in: ['CONFIRMED', 'SENT'] }, employee: { propertyId } },
      }),
    ]);
    const editorIds = [...new Set(rows.map((r) => r.editedById).filter((x): x is string => !!x))];
    const editors = editorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: editorIds } }, select: { id: true, name: true } })
      : [];
    const stale = openSince();
    const dates = new Set([
      ...rows.map((r) => isoDay(r.workDate)),
      ...shifts.filter((s) => s.shiftType !== 'OFF').map((s) => isoDay(s.workDate)),
    ]);
    const days = [...dates].sort().map((d) => {
      const r = rows.find((x) => isoDay(x.workDate) === d);
      const shift = shifts.find((x) => isoDay(x.workDate) === d)?.shiftType ?? null;
      return {
        workDate: d,
        shift,
        attendanceId: r?.id ?? null,
        clockIn: r ? hhmm(r.clockInAt) : null,
        clockOut: r?.clockOutAt ? hhmm(r.clockOutAt) : null,
        hours: r?.clockOutAt
          ? Math.round(((r.clockOutAt.getTime() - r.clockInAt.getTime()) / 3_600_000) * 10) / 10
          : null,
        method: r?.method ?? null,
        outMethod: r?.outMethod ?? null,
        /** 고친 사유 (사장님·매니저가 기록을 고칠 때 남긴 메모) */
        memo: r?.memo ?? null,
        edited: !!r?.editedAt,
        editedAt: r?.editedAt ?? null,
        editedBy: r?.editedById ? (editors.find((u) => u.id === r.editedById)?.name ?? null) : null,
        missingOut: !!r && !r.clockOutAt && r.clockInAt <= stale,
        working: !!r && !r.clockOutAt && r.clockInAt > stale,
        absent: !r && d < today && d >= isoDay(e.hiredDate),
      };
    });
    const done = rows.filter((r) => r.clockOutAt).map((r) => ({ ...r, workDate: isoDay(r.workDate) }));
    return {
      month,
      employee: { id: e.id, name: e.name, jobRole: e.jobRole, hiredDate: isoDay(e.hiredDate) },
      locked: lockedCount > 0,
      totalHours: sumHours(done).hours,
      workedDays: rows.length,
      days,
    };
  }

  /** 지금 근무 중인 기록 — 퇴근 전이고 출근한 지 16시간 안 (어제 밤 야간 근무 포함). at: 이 시각 기준 */
  openShift(employeeId: string, at = new Date()) {
    return this.prisma.attendance.findFirst({
      where: { employeeId, clockOutAt: null, clockInAt: { gt: openSince(at), lte: at } },
      orderBy: { clockInAt: 'desc' },
    });
  }

  /** 이 계정과 연결된 재직 중 직원 기록 (없으면 NOT_LINKED_EMPLOYEE) */
  async selfEmployee(propertyId: string, userId: string) {
    const e = await this.prisma.employee.findFirst({ where: { propertyId, userId, ...employedOn(kstDate()) } });
    if (!e) throw Errors.notLinkedEmployee();
    return e;
  }

  /** 이 업장 직원 (없으면 404) */
  findEmployee(propertyId: string, id: string) {
    return this.employee(propertyId, id);
  }

  // ─── F5-01 직원 ───────────────────────────────────────
  /**
   * 그 번호로 가입한 앱 계정 — 있으면 직원 기록과 연결하고, 이 업장 구성원이 아니면 직원(STAFF)으로 넣는다.
   * 매니저가 자기 번호를 직원으로 넣어 자기 기록(급여·출퇴근)을 고치는 길은 막는다.
   */
  private async linkAccount(propertyId: string, actor: Actor, phone: string, employed: boolean) {
    const user = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (!user) return null;
    if (actor.role === 'MANAGER' && user.id === actor.userId) throw Errors.selfEditForbidden();
    if (employed)
      await this.prisma.membership.upsert({
        where: { userId_propertyId: { userId: user.id, propertyId } },
        create: { userId: user.id, propertyId, role: 'STAFF' },
        update: {},
      });
    return user.id;
  }

  /**
   * 급여(시급·월급)는 사장님만 정한다 — 매니저가 넣거나 바꾸려 하면 403.
   * before 가 있으면(수정) 지금과 같은 값은 바꾸는 게 아니므로 그대로 둔다.
   */
  private guardPay(actor: Actor, dto: { payType?: PayType; payAmount?: number }, before?: Employee) {
    if (actor.role !== 'MANAGER') return;
    const typeChanged = dto.payType !== undefined && dto.payType !== before?.payType;
    const amountChanged = dto.payAmount !== undefined && dto.payAmount !== before?.payAmount;
    if (typeChanged || amountChanged) throw Errors.payOwnerOnly();
  }

  async create(propertyId: string, actor: Actor, dto: EmployeeDto) {
    // 매니저: 자기 계정 연결 막기(SELF_EDIT_FORBIDDEN)를 먼저 본 뒤 급여 막기 — 구성원 추가 같은 부수 효과 전에
    if (actor.role === 'MANAGER') {
      const self = await this.prisma.user.findUnique({ where: { phone: dto.phone }, select: { id: true } });
      if (self?.id === actor.userId) throw Errors.selfEditForbidden();
    }
    this.guardPay(actor, dto);
    if (actor.role !== 'MANAGER' && (dto.payType === undefined || dto.payAmount === undefined))
      throw Errors.payRequired();
    const userId = await this.linkAccount(propertyId, actor, dto.phone, true);
    const e = await this.prisma.employee.create({
      data: {
        propertyId,
        userId,
        name: dto.name.trim(),
        phone: dto.phone,
        jobRole: dto.jobRole,
        // 매니저가 등록하면 그해 최저시급 시급제로 — 사장님이 알바관리에서 정한다
        payType: dto.payType ?? 'HOURLY',
        payAmount: dto.payAmount ?? minimumWageFor(dto.hiredDate),
        hiredDate: dateOnly(dto.hiredDate),
      },
    });
    return { ...e, belowMinimumWage: isBelowMinimumWage(e) };
  }

  async update(propertyId: string, actor: Actor, id: string, dto: UpdateEmployeeDto) {
    const before = await this.employee(propertyId, id);
    this.guardSelfEdit(actor, before);
    this.guardPay(actor, dto, before);
    const today = kstDate();
    const resigned = dto.resignedDate ?? (before.resignedAt ? isoDay(before.resignedAt) : null);
    const employed = !resigned || resigned >= today;
    // 번호를 바꾸면 그 번호로 가입한 계정과 다시 연결 (없으면 연결 해제)
    let userId: string | null | undefined;
    if (dto.phone && dto.phone !== before.phone)
      userId = await this.linkAccount(propertyId, actor, dto.phone, employed);
    const e = await this.prisma.employee.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone,
        userId,
        jobRole: dto.jobRole,
        payType: dto.payType,
        payAmount: dto.payAmount,
        resignedAt: dto.resignedDate ? dateOnly(dto.resignedDate) : undefined,
      },
    });
    // 퇴사일이 지났으면 이 업장 직원(STAFF) 계정 권한도 뺀다 — 사장님·매니저 권한은 그대로
    if (dto.resignedDate && dto.resignedDate < today && e.userId) await this.dropStaffMembership(propertyId, e.userId);
    return { ...e, belowMinimumWage: isBelowMinimumWage(e) };
  }

  /** 같은 계정으로 재직 중인 다른 직원 기록이 없을 때만 STAFF 권한을 지운다 */
  private async dropStaffMembership(propertyId: string, userId: string) {
    const still = await this.prisma.employee.count({ where: { propertyId, userId, ...employedOn(kstDate()) } });
    if (still > 0) return;
    await this.prisma.membership.deleteMany({ where: { propertyId, userId, role: 'STAFF' } });
  }

  // ─── F5-06 근로계약서 ─────────────────────────────────
  async sendContract(propertyId: string, senderId: string, id: string) {
    const e = await this.employee(propertyId, id);
    // 최저시급보다 적은 조건으로는 계약서를 보낼 수 없다
    if (isBelowMinimumWage(e)) throw Errors.belowMinimumWage(currentMinimumWage());
    const property = await this.prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
    return this.quota.use(senderId, 'CONTRACT', () => this.issueContract(e, property.name));
  }

  private async issueContract(e: Employee, propertyName: string) {
    const token = randomToken();
    await this.prisma.laborContract.create({
      data: {
        employeeId: e.id,
        startDate: e.hiredDate,
        payType: e.payType,
        payAmount: e.payAmount,
        tokenHash: sha256(token),
      },
    });
    const web = webOrigin(this.config.get('WEB_ORIGIN', { infer: true }));
    await this.sms.send(
      e.phone,
      `[우주스테이] ${smsSafeName(propertyName)} 근로계약서가 도착했어요. ${CONTRACT_DAYS}일 안에 확인하고 서명해 주세요. ${web}/app/contract/${token}\n우주스테이 앱에서 출퇴근: ${web}/app/login`,
    );
    return {
      status: 'SENT' as const,
      ...(exposeDevSecrets(this.config.get('NODE_ENV', { infer: true })) ? { devToken: token } : {}),
    };
  }

  private async contractByToken(token: string) {
    const c = await this.prisma.laborContract.findUnique({
      where: { tokenHash: sha256(token) },
      include: { employee: { include: { property: true } } },
    });
    if (!c || c.sentAt.getTime() < Date.now() - CONTRACT_DAYS * 86_400_000) throw Errors.contractInvalid();
    return c;
  }

  async viewContract(token: string) {
    const c = await this.contractByToken(token);
    const p = c.employee.property;
    return {
      status: c.status,
      employer: { name: p.name, owner: p.ownerName, address: p.address, bizNo: p.bizNo },
      employee: { name: c.employee.name, jobRole: c.employee.jobRole },
      startDate: isoDay(c.startDate),
      payType: c.payType,
      payAmount: c.payAmount,
      payText: c.payType === 'HOURLY' ? `시급 ${won(c.payAmount)}원` : `월급 ${won(c.payAmount)}원`,
      signedAt: c.signedAt,
    };
  }

  async signContract(token: string, signerName: string) {
    const c = await this.contractByToken(token);
    if (c.status === 'SIGNED') return this.viewContract(token);
    if (signerName.trim() !== c.employee.name) throw Errors.contractNameMismatch();
    await this.prisma.laborContract.update({ where: { id: c.id }, data: { status: 'SIGNED', signedAt: new Date() } });
    await this.notifications.notifyProperty(
      c.employee.propertyId,
      'STAFF',
      `${c.employee.name}님이 근로계약서에 서명했어요.`,
      '/app/staff',
    );
    return this.viewContract(token);
  }

  // ─── F5-02 출퇴근 ─────────────────────────────────────
  /**
   * 출근·퇴근. 직원 본인이 찍으면 위치(반경)나 출근 QR 로 확인한다 (ClockService.verify) —
   * 업장 위치가 없으면 지금처럼 확인 없이 허용. 사장님·매니저가 다른 직원을 찍어 주면 수기(MANUAL).
   * 응답: 출퇴근 기록 + check { method, distanceM, radiusM, locationSet }
   */
  async clock(
    propertyId: string,
    actor: Actor,
    employeeId: string,
    action: 'in' | 'out',
    evidence: ClockEvidence = {},
  ) {
    const e = await this.employee(propertyId, employeeId);
    // 직원 본인은 자기 기록만
    if (actor.role === 'STAFF' && e.userId !== actor.userId) throw Errors.forbidden();
    const self = e.userId === actor.userId;
    const workDate = kstDate();
    let open: Awaited<ReturnType<StaffService['openShift']>> = null;
    // 상태를 먼저 본다 (이미 출근함 · 출근 기록 없음 · 급여 확정) — 그다음 위치·QR
    if (action === 'in') {
      await this.ensureNotLocked(propertyId, workDate.slice(0, 7));
      // 오늘 이미 출근했거나, 어젯밤 야간 근무가 아직 안 끝났으면 다시 출근할 수 없다
      // (16시간 넘게 열린 기록은 퇴근 누락이라 무시 — 오늘 새로 출근할 수 있다)
      const [exists, openNow] = await Promise.all([
        this.prisma.attendance.findUnique({
          where: { employeeId_workDate: { employeeId, workDate: dateOnly(workDate) } },
        }),
        this.openShift(employeeId),
      ]);
      if (exists || openNow) throw Errors.alreadyClockedIn();
    } else {
      // 퇴근: 16시간 안에 출근한 열린 기록만 (어제 퇴근을 깜빡한 기록에 30시간이 붙지 않게)
      open = await this.openShift(employeeId);
      if (!open) throw Errors.notClockedIn();
      // 지난달 마지막 날 밤 야간 근무 — 그 달 급여가 이미 확정됐으면 고칠 수 없다
      await this.ensureNotLocked(propertyId, isoDay(open.workDate).slice(0, 7));
    }
    const check: PresenceCheck | { method: 'MANUAL'; distanceM: null; radiusM: number; locationSet: boolean } = self
      ? await this.clockCheck.verify(propertyId, evidence)
      : await this.clockCheck.property(propertyId).then((p) => ({
          method: 'MANUAL' as const,
          distanceM: null,
          radiusM: p.clockRadiusM,
          locationSet: p.latitude !== null && p.longitude !== null,
        }));
    const now = new Date();
    if (action === 'in') {
      try {
        const a = await this.prisma.attendance.create({
          data: {
            employeeId,
            workDate: dateOnly(workDate),
            clockInAt: now,
            method: check.method,
            inDistanceM: check.distanceM,
          },
        });
        return { ...a, check };
      } catch (err) {
        // 동시에 두 번 눌렀을 때 (employeeId, workDate) 중복
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
          throw Errors.alreadyClockedIn();
        throw err;
      }
    }
    const closed = await this.prisma.attendance.updateMany({
      where: { id: open!.id, clockOutAt: null },
      data: { clockOutAt: now, outMethod: check.method, outDistanceM: check.distanceM },
    });
    if (closed.count === 0) throw Errors.notClockedIn();
    return { ...(await this.prisma.attendance.findUniqueOrThrow({ where: { id: open!.id } })), check };
  }

  /** 그 달 급여가 확정(또는 발송)됐으면 출퇴근 기록을 더하거나 고칠 수 없다 — 확정을 먼저 풀어야 한다 */
  async ensureNotLocked(propertyId: string, month: string) {
    const locked = await this.prisma.payroll.count({
      where: { month: monthStart(month), status: { in: ['CONFIRMED', 'SENT'] }, employee: { propertyId } },
    });
    if (locked > 0) throw Errors.payrollLocked();
  }

  /**
   * 사장님·매니저가 기록을 고치면 누가 언제 고쳤는지 남긴다.
   * 근무일은 오늘까지 · 입사일 이후, 출근≠퇴근, 한 번 근무는 16시간 이하. 급여가 확정된 달은 고칠 수 없다.
   */
  async editAttendance(propertyId: string, actor: Actor, dto: EditAttendanceDto) {
    const e = await this.employee(propertyId, dto.employeeId);
    this.guardSelfEdit(actor, e);
    if (dto.workDate > kstDate()) throw Errors.workDateFuture();
    if (dateOnly(dto.workDate) < e.hiredDate) throw Errors.workDateBeforeHired();
    if (dto.clockOut && dto.clockOut === dto.clockIn) throw Errors.clockSame();
    const clockInAt = atKst(dto.workDate, dto.clockIn);
    let clockOutAt = dto.clockOut ? atKst(dto.workDate, dto.clockOut) : null;
    if (clockOutAt && clockOutAt <= clockInAt) clockOutAt = new Date(clockOutAt.getTime() + 86_400_000);
    if (clockOutAt && clockOutAt.getTime() - clockInAt.getTime() > OPEN_SHIFT_HOURS * 3_600_000)
      throw Errors.shiftTooLong(OPEN_SHIFT_HOURS);
    await this.ensureNotLocked(propertyId, dto.workDate.slice(0, 7));
    const data = {
      clockInAt,
      clockOutAt,
      method: 'MANUAL' as const,
      outMethod: clockOutAt ? ('MANUAL' as const) : null,
      editedById: actor.userId,
      editedAt: new Date(),
      memo: dto.memo,
    };
    return this.prisma.attendance.upsert({
      where: { employeeId_workDate: { employeeId: dto.employeeId, workDate: dateOnly(dto.workDate) } },
      create: { employeeId: dto.employeeId, workDate: dateOnly(dto.workDate), ...data },
      update: data,
    });
  }

  // ─── F5-03 근무표 ─────────────────────────────────────
  async setShift(propertyId: string, employeeId: string, workDate: string, shiftType: ShiftType) {
    await this.employee(propertyId, employeeId);
    return this.prisma.workShift.upsert({
      where: { employeeId_workDate: { employeeId, workDate: dateOnly(workDate) } },
      create: { employeeId, workDate: dateOnly(workDate), shiftType },
      update: { shiftType },
    });
  }

  // ─── F5-04 급여 ───────────────────────────────────────
  /** 그 달 급여 대상 — 그 달 말일 전에 입사했고, 그 달 1일 전에 퇴사하지 않은 직원 */
  private payrollMembers(propertyId: string, month: string) {
    return this.prisma.employee.findMany({
      where: {
        propertyId,
        hiredDate: { lt: monthStart(addMonths(month, 1)) },
        OR: [{ resignedAt: null }, { resignedAt: { gte: monthStart(month) } }],
      },
    });
  }

  /** 출퇴근 기록으로 다시 계산해 확정 전(DRAFT) 명세를 만든다. 확정된 건 그대로 둔다. 앞으로 올 달은 400 */
  async calculatePayroll(propertyId: string, month: string, today = kstDate()) {
    if (month > today.slice(0, 7)) throw Errors.futureMonth();
    const members = await this.payrollMembers(propertyId, month);
    const rows = await this.payrollRows(
      members.map((m) => m.id),
      month,
    );
    for (const m of members) {
      const c = this.calc(m, month, rows);
      const data = {
        workHours: c.hours,
        nightHours: c.nightHours,
        baseAmount: c.base,
        nightAmount: c.night,
        weeklyAmount: c.weekly,
        totalAmount: c.total,
      };
      const existing = await this.prisma.payroll.findUnique({
        where: { employeeId_month: { employeeId: m.id, month: monthStart(month) } },
      });
      if (existing && existing.status !== 'DRAFT') continue;
      await this.prisma.payroll.upsert({
        where: { employeeId_month: { employeeId: m.id, month: monthStart(month) } },
        create: { employeeId: m.id, month: monthStart(month), ...data },
        update: data,
      });
    }
    // 대상에서 빠진 직원(그 달 이후 입사 등)의 확정 전 명세는 지운다
    await this.prisma.payroll.deleteMany({
      where: {
        month: monthStart(month),
        status: 'DRAFT',
        employee: { propertyId },
        employeeId: { notIn: members.map((m) => m.id) },
      },
    });
    return this.payrollList(propertyId, month);
  }

  /**
   * 급여 확정 — 끝난 달(지난달 이전)만.
   * 그 달 최저시급(월급제는 월급 ÷ 209시간) 미만 직원이 있거나, 퇴근 기록이 빠진 근무가 있으면 막는다.
   */
  async confirmPayroll(propertyId: string, month: string, today = kstDate()) {
    if (month > today.slice(0, 7)) throw Errors.futureMonth();
    if (month === today.slice(0, 7)) throw Errors.monthNotEnded();
    const members = await this.payrollMembers(propertyId, month);
    const minimum = minimumWageFor(month);
    if (members.some((m) => isBelowMinimumWage(m, month))) throw Errors.belowMinimumWage(minimum);
    const missing = await this.prisma.attendance.count({
      where: {
        employeeId: { in: members.map((m) => m.id) },
        clockOutAt: null,
        workDate: { gte: monthStart(month), lt: monthStart(addMonths(month, 1)) },
      },
    });
    if (missing > 0) throw Errors.missingClockOut(missing);
    await this.calculatePayroll(propertyId, month, today);
    await this.prisma.payroll.updateMany({
      where: { month: monthStart(month), status: 'DRAFT', employee: { propertyId } },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });
    return this.payrollList(propertyId, month);
  }

  /** 확정 풀기 — 명세를 아직 안 보낸 달만 */
  async reopenPayroll(propertyId: string, month: string) {
    const where = { month: monthStart(month), employee: { propertyId } };
    if ((await this.prisma.payroll.count({ where: { ...where, status: 'SENT' } })) > 0) throw Errors.payrollSent();
    await this.prisma.payroll.updateMany({
      where: { ...where, status: 'CONFIRMED' },
      data: { status: 'DRAFT', confirmedAt: null },
    });
    return this.payrollList(propertyId, month);
  }

  /** 확정된 명세를 직원에게 문자로 */
  async sendPayroll(propertyId: string, month: string) {
    const rows = await this.prisma.payroll.findMany({
      where: { month: monthStart(month), status: { in: ['CONFIRMED', 'SENT'] }, employee: { propertyId } },
      include: { employee: true },
    });
    if (rows.length === 0) throw Errors.payrollNotConfirmed();
    const property = await this.prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
    for (const r of rows) {
      await this.sms.send(
        r.employee.phone,
        `[우주스테이] ${property.name} ${month.replace('-', '년 ')}월 급여명세: 근무 ${Number(r.workHours)}시간, 지급 ${won(r.totalAmount)}원 (기본 ${won(r.baseAmount)} · 야간 ${won(r.nightAmount)} · 주휴 ${won(r.weeklyAmount)})`,
      );
    }
    await this.prisma.payroll.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { status: 'SENT', sentAt: new Date() },
    });
    return this.payrollList(propertyId, month);
  }

  /** 급여 목록 — 확정·발송된 건 저장값, 확정 전(DRAFT)은 지금 출퇴근 기록으로 다시 계산한 값 */
  private async payrollList(propertyId: string, month: string) {
    const rows = await this.prisma.payroll.findMany({
      where: { month: monthStart(month), employee: { propertyId } },
      include: { employee: true },
      orderBy: { employee: { name: 'asc' } },
    });
    const drafts = rows.filter((r) => r.status === 'DRAFT');
    const attendance = drafts.length
      ? await this.payrollRows(
          drafts.map((r) => r.employeeId),
          month,
        )
      : [];
    const items = rows.map((r) => {
      const v =
        r.status === 'DRAFT'
          ? this.calc(r.employee, month, attendance)
          : {
              hours: Number(r.workHours),
              nightHours: Number(r.nightHours),
              base: r.baseAmount,
              night: r.nightAmount,
              weekly: r.weeklyAmount,
              total: r.totalAmount,
            };
      return { employeeId: r.employeeId, name: r.employee.name, ...v, status: r.status };
    });
    return { month, total: items.reduce((s, r) => s + r.total, 0), items };
  }
}
