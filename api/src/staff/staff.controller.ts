import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser, PropertyRoles, Public, type AuthUser } from '../common/decorators/auth.decorators.js';
import { Errors } from '../common/errors/app-error.js';
import { isMonth } from '../common/validation/date-fields.js';
import { kstMonth } from '../common/utils/dates.js';
import { Role } from '../generated/prisma/enums.js';
import {
  AttendanceMonthQuery,
  ClockDto,
  ClockRequestDto,
  ClockRequestQuery,
  RejectClockRequestDto,
  EditAttendanceDto,
  EmployeeDto,
  ShiftDto,
  SignContractDto,
  StaffQuery,
  UpdateEmployeeDto,
} from './staff.dto.js';
import { StaffService } from './staff.service.js';
import { EventsService } from '../events/events.service.js';
import { ClockRequestsService } from './clock-requests.service.js';
import { ClockService } from './clock.service.js';

const month = (m: string) => {
  if (!isMonth(m)) throw Errors.badMonth();
  return m;
};

@ApiTags('알바관리 (F5-01 ~ F5-06)')
@ApiBearerAuth()
@Controller('properties/:propertyId/staff')
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly events: EventsService,
    private readonly requests: ClockRequestsService,
  ) {}

  @Get()
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '직원 · 오늘 출퇴근 · 이번 주 근무표(?week 로 다른 주) · 이번 달 급여 · 퇴근 누락' })
  async overview(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Req() req: Request & { role: Role },
    @Query() q: StaffQuery,
  ) {
    const data = await this.staff.overview(propertyId, q.date, q.week);
    if (req.role !== Role.MANAGER) return data;
    // 매니저에게는 급여 정보를 내려주지 않는다 (화면에서 숨기는 것만으로는 브라우저로 전달됨)
    return { ...data, members: data.members.map((m) => ({ ...m, payAmount: 0 })), payroll: [] };
  }

  @Get('me')
  @ApiOperation({
    summary:
      '직원 본인 — 오늘 출퇴근 · 이번 주·다음 주 근무(없는 날 null) · 같이 일하는 사람 · 이번 달 기록 · 급여 내역',
  })
  mine(@Param('propertyId', ParseUUIDPipe) propertyId: string, @CurrentUser() user: AuthUser) {
    return this.staff.mine(propertyId, user.id);
  }

  @Get('employees/:id/attendance')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '직원 한 명의 한 달 출퇴근 (?month=YYYY-MM, 없으면 이번 달) — 날짜별 기록·고친 사유·누락' })
  attendance(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: AttendanceMonthQuery,
  ) {
    return this.staff.employeeAttendance(propertyId, id, q.month ?? kstMonth());
  }

  @Post('employees')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({
    summary: '직원 등록 (최저시급 미만이면 belowMinimumWage, 이미 가입한 번호면 직원 계정으로 연결)',
  })
  create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request & { role: Role },
    @Body() dto: EmployeeDto,
  ) {
    return this.staff.create(propertyId, { userId: user.id, role: req.role }, dto);
  }

  @Patch('employees/:id')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '직원 정보·급여 수정 (매니저는 자기 기록을 고칠 수 없음)' })
  update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request & { role: Role },
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.staff.update(propertyId, { userId: user.id, role: req.role }, id, dto);
  }

  @Post('employees/:id/contract')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER])
  @ApiOperation({ summary: '근로계약서 보내기 (문자로 서명 링크)' })
  sendContract(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.staff.sendContract(propertyId, user.id, id);
  }

  @Post('attendance/clock')
  @HttpCode(200)
  @ApiOperation({
    summary:
      '출근·퇴근 (직원은 본인 것만) — 본인이 찍으면 위치(latitude·longitude·accuracy) 또는 qr 로 확인. ' +
      '업장 위치가 없으면 확인 없이 허용(check.locationSet false). 사장님·매니저가 다른 직원을 찍으면 수기',
  })
  async clock(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request & { role: Role },
    @Body() dto: ClockDto,
  ) {
    if (dto.method === 'QR' && !dto.qr) throw Errors.qrInvalid();
    const r = await this.staff.clock(propertyId, { userId: user.id, role: req.role }, dto.employeeId, dto.action, {
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy,
      qr: dto.qr,
    });
    if (dto.action === 'in')
      await this.events.record('CLOCK_IN', {
        userId: user.id,
        propertyId,
        meta: { employeeId: dto.employeeId, method: r.check.method, self: req.role === 'STAFF' },
      });
    return r;
  }

  @Post('clock-requests')
  @ApiOperation({
    summary: '출퇴근 요청 보내기 (직원 본인) — 위치·QR 로 안 될 때 사유와 함께. 사장님·매니저에게 알림 + 앱 푸시',
  })
  createRequest(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ClockRequestDto,
  ) {
    return this.requests.create(propertyId, user.id, dto);
  }

  @Get('clock-requests/mine')
  @ApiOperation({ summary: '내 출퇴근 요청 (최근 30일, 새 순)' })
  myRequests(@Param('propertyId', ParseUUIDPipe) propertyId: string, @CurrentUser() user: AuthUser) {
    return this.requests.mine(propertyId, user.id);
  }

  @Get('clock-requests')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '출퇴근 요청 목록 (?status=PENDING 기본 · APPROVED · REJECTED · ALL)' })
  listRequests(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query() q: ClockRequestQuery) {
    return this.requests.list(propertyId, q.status);
  }

  @Post('clock-requests/:id/approve')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '출퇴근 요청 승인 — 요청 시각으로 기록 (매니저는 자기 요청을 처리할 수 없음)' })
  async approveRequest(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request & { role: Role },
  ) {
    const r = await this.requests.approve(propertyId, { userId: user.id, role: req.role }, id);
    if (r.type === 'IN')
      await this.events.record('CLOCK_IN', {
        userId: user.id,
        propertyId,
        meta: { employeeId: r.employeeId, method: 'REQUEST', self: false },
      });
    return r;
  }

  @Post('clock-requests/:id/reject')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '출퇴근 요청 거절 (사유 필수)' })
  rejectRequest(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request & { role: Role },
    @Body() dto: RejectClockRequestDto,
  ) {
    return this.requests.reject(propertyId, { userId: user.id, role: req.role }, id, dto.reason);
  }

  @Post('clock/undo-out')
  @HttpCode(200)
  @ApiOperation({ summary: '퇴근 되돌리기 — 직원 본인, 퇴근 후 5분 안 · 그 달 급여 확정 전만' })
  undoOut(@Param('propertyId', ParseUUIDPipe) propertyId: string, @CurrentUser() user: AuthUser) {
    return this.staff.undoClockOut(propertyId, user.id);
  }

  @Put('attendance')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '출퇴근 기록 수정 (수정 이력 남김, 매니저는 자기 기록을 고칠 수 없음)' })
  editAttendance(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request & { role: Role },
    @Body() dto: EditAttendanceDto,
  ) {
    return this.staff.editAttendance(propertyId, { userId: user.id, role: req.role }, dto);
  }

  @Put('shifts')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '근무표 한 칸 (주간·야간·휴무)' })
  shift(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body() dto: ShiftDto) {
    return this.staff.setShift(propertyId, dto.employeeId, dto.workDate, dto.shiftType);
  }

  @Post('payroll/:month/calculate')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '급여 다시 계산 (확정 전 명세)' })
  calc(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('month') m: string) {
    return this.staff.calculatePayroll(propertyId, month(m));
  }

  @Post('payroll/:month/confirm')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER])
  @ApiOperation({ summary: '급여 확정 (지난달 이전만, 최저시급 미만 직원이 있으면 불가)' })
  async confirm(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('month') m: string,
    @CurrentUser() user: AuthUser,
  ) {
    const r = await this.staff.confirmPayroll(propertyId, month(m));
    await this.events.record('PAYROLL_CONFIRM', { userId: user.id, propertyId, meta: { month: month(m) } });
    return r;
  }

  @Post('payroll/:month/reopen')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER])
  @ApiOperation({ summary: '급여 확정 풀기 (명세를 보내기 전만)' })
  reopen(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('month') m: string) {
    return this.staff.reopenPayroll(propertyId, month(m));
  }

  @Post('payroll/:month/send')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER])
  @ApiOperation({ summary: '급여명세 문자 발송' })
  send(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('month') m: string) {
    return this.staff.sendPayroll(propertyId, month(m));
  }
}

/** 출근 QR — 인쇄용 내용 (사장님·매니저), 새로 만들기 (사장님) */
@ApiTags('출근 QR')
@ApiBearerAuth()
@Controller('properties/:propertyId/clock-qr')
export class ClockQrController {
  constructor(private readonly clock: ClockService) {}

  @Get()
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '출근 QR 내용 (인쇄용 — 고정, 회전하지 않음)' })
  get(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.clock.qr(propertyId);
  }

  @Post('rotate')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER])
  @ApiOperation({ summary: 'QR 새로 만들기 — 예전에 인쇄한 QR 은 더 이상 안 된다' })
  rotate(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.clock.rotateQr(propertyId);
  }
}

/** 직원이 문자 링크로 여는 근로계약서 (로그인 없음) */
@ApiTags('근로계약서 서명 (F5-06)')
@Controller('contracts')
export class ContractsController {
  constructor(private readonly staff: StaffService) {}

  @Public()
  @Get(':token')
  view(@Param('token') token: string) {
    return this.staff.viewContract(token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':token/sign')
  @HttpCode(200)
  sign(@Param('token') token: string, @Body() dto: SignContractDto) {
    return this.staff.signContract(token, dto.signerName);
  }
}
