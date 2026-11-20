import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type {} from 'multer';
import { CurrentUser, PropertyRoles, type AuthUser } from '../common/decorators/auth.decorators.js';
import { Role } from '../generated/prisma/enums.js';
import { ExpenseDto, ExpenseQuery, OrderDto, OrderStatusDto } from './expenses.dto.js';
import { ExpensesService } from './expenses.service.js';
import { EventsService } from '../events/events.service.js';

const PID = 'propertyId';

@ApiTags('지출관리 (F6-01 ~ F6-04)')
@ApiBearerAuth()
@Controller('properties/:propertyId')
export class ExpensesController {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly events: EventsService,
  ) {}

  @Get('expenses')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '월 지출 · 분류별 합계 · 발주 · 등록 대기 영수증' })
  month(@Param(PID, ParseUUIDPipe) propertyId: string, @Query() q: ExpenseQuery) {
    return this.expenses.month(propertyId, q.month);
  }

  @Post('expenses')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  create(@Param(PID, ParseUUIDPipe) propertyId: string, @CurrentUser() user: AuthUser, @Body() dto: ExpenseDto) {
    return this.expenses.create(propertyId, user.id, dto);
  }

  @Put('expenses/:id')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  update(
    @Param(PID, ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExpenseDto,
  ) {
    return this.expenses.update(propertyId, id, dto);
  }

  @Delete('expenses/:id')
  @HttpCode(204)
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  async remove(@Param(PID, ParseUUIDPipe) propertyId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.expenses.remove(propertyId, id);
  }

  @Post('receipts')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  // 한글 파일 이름이 깨지지 않게 utf8 로 읽는다 (multer 기본은 latin1)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 }, defParamCharset: 'utf8' }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: '영수증 사진 올리기 → 상호·날짜·금액 인식' })
  upload(
    @Param(PID, ParseUUIDPipe) propertyId: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.expenses.uploadReceipt(propertyId, user.id, file);
  }

  @Get('receipts/:id/file')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  async file(
    @Param(PID, ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const f = await this.expenses.receiptFile(propertyId, id);
    // 브라우저가 내용을 짐작해 HTML 로 열지 않게
    res.set('X-Content-Type-Options', 'nosniff');
    const name = encodeURIComponent(f.fileName);
    res.set('Content-Disposition', `${f.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${name}`);
    res.type(f.mimeType).send(f.body);
  }

  @Post('receipts/:id/register')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '확인한 내용으로 지출 등록' })
  async register(
    @Param(PID, ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ExpenseDto,
  ) {
    const r = await this.expenses.registerReceipt(propertyId, user.id, id, dto);
    await this.events.record('RECEIPT_REGISTER', { userId: user.id, propertyId, meta: { receiptId: id } });
    return r;
  }

  @Post('orders')
  @PropertyRoles([Role.OWNER, Role.MANAGER, Role.STAFF])
  @ApiOperation({ summary: '발주 요청 (직원도 가능)' })
  order(@Param(PID, ParseUUIDPipe) propertyId: string, @CurrentUser() user: AuthUser, @Body() dto: OrderDto) {
    return this.expenses.createOrder(propertyId, user.id, dto);
  }

  @Patch('orders/:id')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '발주함 · 입고 확인(지출 자동 등록) · 취소' })
  orderStatus(
    @Param(PID, ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: OrderStatusDto,
  ) {
    return this.expenses.setOrderStatus(propertyId, user.id, id, dto.status);
  }
}
