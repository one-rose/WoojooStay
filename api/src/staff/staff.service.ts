import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Errors } from '../common/errors/app-error.js';
import { addDaysIso, addMonths, dateOnly, isoDay, kstDate, kstHour, monthStart } from '../common/utils/dates.js';
import { randomToken, sha256 } from '../common/utils/crypto.js';
import { exposeDevSecrets, webOrigin, type Env } from '../config/env.js';
import { Prisma, type Employee } from '../generated/prisma/client.js';
import type { ClockMethod, Role, ShiftType } from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmsSender } from '../sms/sms-sender.js';
import { computeMonthlyPay, isBelowMinimumWage, MINIMUM_WAGE, monthWeekRange, sumHours } from './payroll.js';
import type { EditAttendanceDto, EmployeeDto, UpdateEmployeeDto } from './staff.dto.js';

const KST_OFFSET = '+09:00';
const won = (n: number) => n.toLocaleString('ko-KR');
const hhmm = (d: Date) => new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(11, 16);
const atKst = (date: string, time: string) => new Date(`${date}T${time}:00${KST_OFFSET}`);
const CONTRACT_DAYS = 7;
/** 출근 후 이 시간이 지나도 퇴근 기록이 없으면 '퇴근 누락'으로 보고, 지금 근무 중으로 치지 않는다 */
export const OPEN_SHIFT_HOURS = 16;
const openSince = (now = new Date()) => new Date(now.getTime() - OPEN_SHIFT_HOURS * 3_600_000);
type AttendanceRow = { employeeId: string; workDate: Date; clockInAt: Date; clockOutAt: Date | null };
type Actor = { userId: string; role: Role };

/** 알바관리 (F5-01 직원 · F5-02 출퇴근 · F5-03 근무표 · F5-04 급여 · F5-06 근로계약서) */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsSender,
    private readonly config: ConfigService<Env, true>,
    private readonly notifications: NotificationsService,
  ) {}

  private async employee(propertyId: string, id: string) {
    const e = await this.prisma.employee.findFirst({ where: { id, propertyId } });
    if (!e) throw Errors.notFound('직원');
    return e;
  }

  /** 화면 한 장 — 직원·오늘 출퇴근·이번 주 근무표·이번 달 급여 */
  async overview(propertyId: string, date = kstDate()) {
    const month = date.slice(0, 7);
    const monday = addDaysIso(date, -((dateOnly(date).getUTCDay() + 6) % 7));
    const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
    const members = await this.prisma.employee.findMany({
      where: {
        propertyId,
        OR: [{ resignedAt: null }, { resignedAt: { gte: monthStart(month) } }],
      },
      orderBy: [{ hiredDate: 'asc' }, { name: 'asc' }],
      include: { contracts: { orderBy: { sentAt: 'desc' }, take: 1 } },
    });
    const ids = members.map((m) => m.id);
    const [today, monthRows, shifts, saved, missing] = await Promise.all([
      this.prisma.attendance.findMany({ where: { employeeId: { in: ids }, workDate: dateOnly(date) } }),
      this.payrollRows(ids, month),
      this.prisma.workShift.findMany({
        where: { employeeId: { in: ids }, workDate: { gte: dateOnly(weekDates[0]), lte: dateOnly(weekDates[6]) } },
      }),
      this.prisma.payroll.findMany({ where: { employeeId: { in: ids }, month: monthStart(month) } }),
      // 퇴근을 안 찍고 16시간 넘게 열린 기록 (최근 31일) — 사장님이 고쳐 줘야 한다
      this.prisma.attendance.findMany({
        where: {
          employeeId: { in: ids },
          clockOutAt: null,
          clockInAt: { lte: openSince() },
          workDate: { gte: dateOnly(addDaysIso(kstDate(), -31)) },
        },
        orderBy: { workDate: 'desc' },
      }),
    ]);

    const isToday = date === kstDate();
    const stale = openSince();
    const hour = kstHour();
    const todayShift = (id: string) =>
      shifts.find((s) => s.employeeId === id && isoDay(s.workDate) === date)?.shiftType;

    return {
      date,
      month,
      minimumWage: MINIMUM_WAGE,
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
      today: members.map((m) => {
        const a = today.find((x) => x.employeeId === m.id);
        const shift = todayShift(m.id);
        let status: 'working' | 'done' | 'missing-out' | 'late' | 'off';
        if (a) status = a.clockOutAt ? 'done' : isToday && a.clockInAt > stale ? 'working' : 'missing-out';
        else if (shift === 'DAY' && (!isToday || hour >= 9)) status = 'late';
        else if (shift === 'NIGHT' && (!isToday || hour >= 22)) status = 'late';
        else status = 'off';
        return {
          employeeId: m.id,
          attendanceId: a?.id ?? null,
          in: a ? hhmm(a.clockInAt) : null,
          out: a?.clockOutAt ? hhmm(a.clockOutAt) : null,
          status,
          edited: Boolean(a?.editedAt),
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
      week: {
        dates: weekDates,
        shifts: Object.fromEntries(
          members.map((m) => [
            m.id,
            weekDates.map(
              (d) =>
                shifts.find((s) => s.employeeId === m.id && isoDay(s.workDate) === d)?.shiftType ??
                ('OFF' as ShiftType),
            ),
          ]),
        ),
      },
      payroll: members.map((m) => {
        const row = saved.find((p) => p.employeeId === m.id);
        if (row)
          return {
            employeeId: m.id,
            hours: Number(row.workHours),
            nightHours: Number(row.nightHours),
            base: row.baseAmount,
            night: row.nightAmount,
            weekly: row.weeklyAmount,
            total: row.totalAmount,
            status: row.status,
          };
        return { employeeId: m.id, ...this.calc(m, month, monthRows), status: null };
      }),
      /** 퇴근 누락 — 출근 후 16시간 넘게 퇴근 기록이 없음. 기록 수정(PUT attendance)으로 고친다 */
      missingClockOut: missing.map((a) => ({
        employeeId: a.employeeId,
        name: members.find((m) => m.id === a.employeeId)?.name ?? '',
        attendanceId: a.id,
        date: isoDay(a.workDate),
        in: hhmm(a.clockInAt),
      })),
    };
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

  /** 매니저는 자기 직원 기록(급여·출퇴근)을 고칠 수 없다 — 사장님만 */
  private guardSelfEdit(actor: Actor, e: Employee) {
    if (actor.role === 'MANAGER' && e.userId === actor.userId) throw Errors.selfEditForbidden();
  }

  /** 직원 본인 화면 — 오늘 출퇴근 · 이번 주 근무 · 이번 달 기록 (F5-02 직원 모바일) */
  async mine(propertyId: string, userId: string, date = kstDate()) {
    const e = await this.prisma.employee.findFirst({
      where: { propertyId, userId, resignedAt: null },
      include: { property: { select: { name: true } } },
    });
    if (!e) throw Errors.notLinkedEmployee();
    const month = date.slice(0, 7);
    const monday = addDaysIso(date, -((dateOnly(date).getUTCDay() + 6) % 7));
    const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
    const [allRows, shifts, open] = await Promise.all([
      this.payrollRows([e.id], month),
      this.prisma.workShift.findMany({
        where: { employeeId: e.id, workDate: { gte: dateOnly(weekDates[0]), lte: dateOnly(weekDates[6]) } },
      }),
      this.openShift(e.id),
    ]);
    const rows = allRows
      .filter((r) => isoDay(r.workDate).startsWith(month))
      .sort((a, b) => b.workDate.getTime() - a.workDate.getTime());
    const today = rows.find((r) => isoDay(r.workDate) === date);
    const pay = this.calc(e, month, allRows);
    const h = { hours: pay.hours, nightHours: pay.nightHours };
    return {
      date,
      property: e.property.name,
      employee: { id: e.id, name: e.name, jobRole: e.jobRole, payType: e.payType, payAmount: e.payAmount },
      /** 지금 누를 버튼: 출근 / 퇴근 / 오늘 끝 */
      state: open ? 'working' : today ? 'done' : 'ready',
      today: {
        in: (open ?? today) ? hhmm((open ?? today)!.clockInAt) : null,
        out: today?.clockOutAt ? hhmm(today.clockOutAt) : null,
        shift: shifts.find((s) => isoDay(s.workDate) === date)?.shiftType ?? 'OFF',
      },
      week: {
        dates: weekDates,
        shifts: weekDates.map((d) => shifts.find((s) => isoDay(s.workDate) === d)?.shiftType ?? ('OFF' as ShiftType)),
      },
      month: { hours: h.hours, nightHours: h.nightHours, estimatedPay: pay.total },
      records: rows.map((r) => ({
        date: isoDay(r.workDate),
        in: hhmm(r.clockInAt),
        out: r.clockOutAt ? hhmm(r.clockOutAt) : null,
        hours: r.clockOutAt
          ? Math.round(((r.clockOutAt.getTime() - r.clockInAt.getTime()) / 3_600_000) * 10) / 10
          : null,
        edited: r.editedAt !== null,
      })),
    };
  }

  /** 지금 근무 중인 기록 — 퇴근 전이고 출근한 지 16시간 안 (어제 밤 야간 근무 포함) */
  private openShift(employeeId: string) {
    return this.prisma.attendance.findFirst({
      where: { employeeId, clockOutAt: null, clockInAt: { gt: openSince() } },
      orderBy: { clockInAt: 'desc' },
    });
  }

  // ─── F5-01 직원 ───────────────────────────────────────
  async create(propertyId: string, dto: EmployeeDto) {
    const linked = await this.prisma.membership.findFirst({
      where: { propertyId, user: { phone: dto.phone } },
      select: { userId: true },
    });
    const e = await this.prisma.employee.create({
      data: {
        propertyId,
        userId: linked?.userId ?? null,
        name: dto.name.trim(),
        phone: dto.phone,
        jobRole: dto.jobRole,
        payType: dto.payType,
        payAmount: dto.payAmount,
        hiredDate: dateOnly(dto.hiredDate),
      },
    });
    return { ...e, belowMinimumWage: isBelowMinimumWage(e) };
  }

  async update(propertyId: string, actor: Actor, id: string, dto: UpdateEmployeeDto) {
    const before = await this.employee(propertyId, id);
    this.guardSelfEdit(actor, before);
    // 번호를 바꾸면 그 번호로 가입한 구성원 계정과 다시 연결 (없으면 연결 해제)
    let userId: string | null | undefined;
    if (dto.phone && dto.phone !== before.phone) {
      const linked = await this.prisma.membership.findFirst({
        where: { propertyId, user: { phone: dto.phone } },
        select: { userId: true },
      });
      userId = linked?.userId ?? null;
    }
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
    return { ...e, belowMinimumWage: isBelowMinimumWage(e) };
  }

  // ─── F5-06 근로계약서 ─────────────────────────────────
  async sendContract(propertyId: string, id: string) {
    const e = await this.employee(propertyId, id);
    // 최저시급보다 적은 조건으로는 계약서를 보낼 수 없다
    if (isBelowMinimumWage(e)) throw Errors.belowMinimumWage(MINIMUM_WAGE);
    const property = await this.prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
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
    const url = `${webOrigin(this.config.get('WEB_ORIGIN', { infer: true }))}/app/contract/${token}`;
    await this.sms.send(
      e.phone,
      `[우주스테이] ${property.name} 근로계약서가 도착했어요. ${CONTRACT_DAYS}일 안에 확인하고 서명해 주세요. ${url}`,
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
  async clock(propertyId: string, actor: Actor, employeeId: string, action: 'in' | 'out', method: ClockMethod = 'GPS') {
    const e = await this.employee(propertyId, employeeId);
    // 직원 본인은 자기 기록만
    if (actor.role === 'STAFF' && e.userId !== actor.userId) throw Errors.forbidden();
    const workDate = kstDate();
    const now = new Date();
    if (action === 'in') {
      // 오늘 이미 출근했거나, 어젯밤 야간 근무가 아직 안 끝났으면 다시 출근할 수 없다
      // (16시간 넘게 열린 기록은 퇴근 누락이라 무시 — 오늘 새로 출근할 수 있다)
      const [exists, open] = await Promise.all([
        this.prisma.attendance.findUnique({
          where: { employeeId_workDate: { employeeId, workDate: dateOnly(workDate) } },
        }),
        this.openShift(employeeId),
      ]);
      if (exists || open) throw Errors.alreadyClockedIn();
      try {
        return await this.prisma.attendance.create({
          data: { employeeId, workDate: dateOnly(workDate), clockInAt: now, method },
        });
      } catch (err) {
        // 동시에 두 번 눌렀을 때 (employeeId, workDate) 중복
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
          throw Errors.alreadyClockedIn();
        throw err;
      }
    }
    // 퇴근: 16시간 안에 출근한 열린 기록만 (어제 퇴근을 깜빡한 기록에 30시간이 붙지 않게)
    const open = await this.openShift(employeeId);
    if (!open) throw Errors.notClockedIn();
    const closed = await this.prisma.attendance.updateMany({
      where: { id: open.id, clockOutAt: null },
      data: { clockOutAt: now },
    });
    if (closed.count === 0) throw Errors.notClockedIn();
    return this.prisma.attendance.findUniqueOrThrow({ where: { id: open.id } });
  }

  /** 사장님·매니저가 기록을 고치면 누가 언제 고쳤는지 남긴다 */
  async editAttendance(propertyId: string, actor: Actor, dto: EditAttendanceDto) {
    const e = await this.employee(propertyId, dto.employeeId);
    this.guardSelfEdit(actor, e);
    const clockInAt = atKst(dto.workDate, dto.clockIn);
    let clockOutAt = dto.clockOut ? atKst(dto.workDate, dto.clockOut) : null;
    if (clockOutAt && clockOutAt <= clockInAt) clockOutAt = new Date(clockOutAt.getTime() + 86_400_000);
    const data = {
      clockInAt,
      clockOutAt,
      method: 'MANUAL' as const,
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

  /** 출퇴근 기록으로 다시 계산해 확정 전(DRAFT) 명세를 만든다. 확정된 건 그대로 둔다. */
  async calculatePayroll(propertyId: string, month: string) {
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

  /** 급여 확정 — 끝난 달(지난달 이전)만, 최저시급 미만 직원이 있으면 막는다 */
  async confirmPayroll(propertyId: string, month: string, today = kstDate()) {
    if (month >= today.slice(0, 7)) throw Errors.monthNotEnded();
    const members = await this.payrollMembers(propertyId, month);
    if (members.some((m) => isBelowMinimumWage(m))) throw Errors.belowMinimumWage(MINIMUM_WAGE);
    await this.calculatePayroll(propertyId, month);
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

  private async payrollList(propertyId: string, month: string) {
    const rows = await this.prisma.payroll.findMany({
      where: { month: monthStart(month), employee: { propertyId } },
      include: { employee: { select: { name: true } } },
      orderBy: { employee: { name: 'asc' } },
    });
    return {
      month,
      total: rows.reduce((s, r) => s + r.totalAmount, 0),
      items: rows.map((r) => ({
        employeeId: r.employeeId,
        name: r.employee.name,
        hours: Number(r.workHours),
        nightHours: Number(r.nightHours),
        base: r.baseAmount,
        night: r.nightAmount,
        weekly: r.weeklyAmount,
        total: r.totalAmount,
        status: r.status,
      })),
    };
  }
}
