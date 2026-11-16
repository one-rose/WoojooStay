import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Errors } from '../common/errors/app-error.js';
import { addMonths, dateOnly, isoDay, kstDate, kstMonth, monthStart, prevToDateEnd } from '../common/utils/dates.js';
import type { Env } from '../config/env.js';
import type { Expense, PurchaseOrder, Receipt } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ExpenseDto, OrderDto } from './expenses.dto.js';
import { ReceiptReader } from './receipt-reader.js';

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'];

/** 파일 첫 바이트(시그니처)로 실제 형식 — 사진(JPG·PNG·WEBP·HEIC)·PDF 가 아니면 null */
export function sniffReceiptType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP')
    return 'image/webp';
  if (
    buf.length >= 12 &&
    buf.toString('latin1', 4, 8) === 'ftyp' &&
    HEIC_BRANDS.includes(buf.toString('latin1', 8, 12))
  )
    return 'image/heic';
  if (buf.length >= 5 && buf.toString('latin1', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

const toExpense = (e: Expense) => ({
  id: e.id,
  date: isoDay(e.expenseDate),
  vendor: e.vendor,
  category: e.category,
  amount: e.amount,
  source: e.source,
  memo: e.memo,
});

const toOrder = (o: PurchaseOrder) => ({
  id: o.id,
  date: o.requestedAt.toISOString(),
  item: o.itemName,
  qty: o.quantity,
  unit: o.unit,
  vendor: o.vendor,
  amount: o.amount,
  category: o.category,
  status: o.status,
  expenseId: o.expenseId,
});

const toReceipt = (r: Receipt) => ({
  id: r.id,
  fileName: r.fileName,
  status: r.status,
  reading: {
    vendor: r.ocrVendor,
    date: r.ocrDate ? isoDay(r.ocrDate) : null,
    amount: r.ocrAmount,
    category: r.ocrCategory,
  },
  expenseId: r.expenseId,
  createdAt: r.createdAt,
});

/** 지출관리 (F6-01 지출 · F6-03 영수증 · F6-04 발주) */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reader: ReceiptReader,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async month(propertyId: string, month = kstMonth()) {
    const from = monthStart(month);
    const to = monthStart(addMonths(month, 1));
    const prevFrom = monthStart(addMonths(month, -1));
    const [items, prev, prevToDate, sales, orders, receipts] = await Promise.all([
      this.prisma.expense.findMany({
        where: { propertyId, expenseDate: { gte: from, lt: to } },
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.expense.aggregate({
        where: { propertyId, expenseDate: { gte: prevFrom, lt: from } },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: { propertyId, expenseDate: { gte: prevFrom, lt: prevToDateEnd(month) } },
        _sum: { amount: true },
      }),
      this.prisma.booking.aggregate({
        where: { propertyId, status: 'CONFIRMED', checkinDate: { gte: from, lt: to } },
        _sum: { saleAmount: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          propertyId,
          OR: [{ status: { in: ['REQUESTED', 'ORDERED'] } }, { requestedAt: { gte: from, lt: to } }],
        },
        orderBy: { requestedAt: 'desc' },
        take: 50,
      }),
      this.prisma.receipt.findMany({ where: { propertyId, status: 'SCANNED' }, orderBy: { createdAt: 'desc' } }),
    ]);
    const byCategory = new Map<string, number>();
    for (const e of items) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    return {
      month,
      total: items.reduce((s, e) => s + e.amount, 0),
      prevTotal: prev._sum.amount ?? 0,
      /** 지난달 같은 날까지 합계 — 이번 달(진행 중)과 비교할 때. 지난 달을 볼 때는 prevTotal 과 같다 */
      prevTotalToDate: prevToDate._sum.amount ?? 0,
      sales: sales._sum.saleAmount ?? 0,
      byCategory: [...byCategory]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      items: items.map(toExpense),
      orders: orders.map(toOrder),
      pendingReceipts: receipts.map(toReceipt),
    };
  }

  private expenseData(propertyId: string, userId: string, dto: ExpenseDto, source: 'MANUAL' | 'RECEIPT' | 'ORDER') {
    return {
      propertyId,
      expenseDate: dateOnly(dto.date),
      vendor: dto.vendor.trim(),
      category: dto.category,
      amount: dto.amount,
      memo: dto.memo,
      source,
      createdById: userId,
    };
  }

  async create(propertyId: string, userId: string, dto: ExpenseDto, source: 'MANUAL' | 'RECEIPT' | 'ORDER' = 'MANUAL') {
    const e = await this.prisma.expense.create({ data: this.expenseData(propertyId, userId, dto, source) });
    return toExpense(e);
  }

  async update(propertyId: string, id: string, dto: ExpenseDto) {
    await this.own(propertyId, id);
    const e = await this.prisma.expense.update({
      where: { id },
      data: {
        expenseDate: dateOnly(dto.date),
        vendor: dto.vendor.trim(),
        category: dto.category,
        amount: dto.amount,
        memo: dto.memo,
      },
    });
    return toExpense(e);
  }

  async remove(propertyId: string, id: string) {
    await this.own(propertyId, id);
    await this.prisma.expense.delete({ where: { id } });
  }

  private async own(propertyId: string, id: string) {
    const e = await this.prisma.expense.findFirst({ where: { id, propertyId } });
    if (!e) throw Errors.notFound('지출');
    return e;
  }

  // ─── F6-03 영수증 ───────────────────────────────────
  async uploadReceipt(
    propertyId: string,
    userId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
  ) {
    if (!file) throw Errors.fileRequired();
    if (!RECEIPT_TYPES.includes(file.mimetype)) throw Errors.fileType();
    if (file.size > MAX_RECEIPT_BYTES) throw Errors.fileTooLarge();
    // 확장자·Content-Type 이 아니라 실제 내용으로 확인 (HTML 등을 사진인 척 올리지 못하게)
    const sniffed = sniffReceiptType(file.buffer);
    if (!sniffed || sniffed !== file.mimetype) throw Errors.fileType();
    const dir = resolve(this.config.get('UPLOAD_DIR', { infer: true }), 'receipts', propertyId);
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}${extname(file.originalname).toLowerCase().slice(0, 6)}`;
    await writeFile(join(dir, name), file.buffer);
    const reading = await this.reader.read(file.buffer, file.mimetype);
    const r = await this.prisma.receipt.create({
      data: {
        propertyId,
        fileName: file.originalname.slice(0, 120),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath: join('receipts', propertyId, name),
        ocrVendor: reading.vendor,
        ocrDate: reading.date ? dateOnly(reading.date) : null,
        ocrAmount: reading.amount,
        ocrCategory: reading.category,
        uploadedById: userId,
      },
    });
    return toReceipt(r);
  }

  async receiptFile(propertyId: string, id: string) {
    const r = await this.prisma.receipt.findFirst({ where: { id, propertyId } });
    if (!r) throw Errors.notFound('영수증');
    const base = resolve(this.config.get('UPLOAD_DIR', { infer: true }));
    const body = await readFile(join(base, r.storagePath));
    // 예전에 검사 없이 올라온 파일도 있으니 내려줄 때 한 번 더 본다 — 사진·PDF 가 아니면 다운로드로만
    const type = sniffReceiptType(body);
    return { mimeType: type ?? 'application/octet-stream', fileName: r.fileName, inline: type !== null, body };
  }

  /** 인식 결과를 사장님이 확인·수정한 뒤 지출로 등록 */
  async registerReceipt(propertyId: string, userId: string, id: string, dto: ExpenseDto) {
    const r = await this.prisma.receipt.findFirst({ where: { id, propertyId } });
    if (!r) throw Errors.notFound('영수증');
    if (r.status === 'REGISTERED') throw Errors.receiptRegistered();
    // 먼저 '등록됨'으로 잡고 지출을 만든다 — 두 번 눌러도 지출은 하나 (실패하면 함께 되돌아감)
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.receipt.updateMany({
        where: { id, propertyId, status: 'SCANNED' },
        data: { status: 'REGISTERED' },
      });
      if (claimed.count === 0) throw Errors.receiptRegistered();
      const e = await tx.expense.create({ data: this.expenseData(propertyId, userId, dto, 'RECEIPT') });
      await tx.receipt.update({ where: { id }, data: { expenseId: e.id } });
      return toExpense(e);
    });
  }

  // ─── F6-04 발주 ─────────────────────────────────────
  async createOrder(propertyId: string, userId: string, dto: OrderDto) {
    const o = await this.prisma.purchaseOrder.create({
      data: {
        propertyId,
        itemName: dto.item.trim(),
        quantity: dto.qty,
        unit: dto.unit.trim(),
        vendor: dto.vendor.trim(),
        amount: dto.amount,
        category: dto.category ?? 'AMENITY',
        createdById: userId,
      },
    });
    return toOrder(o);
  }

  /** 입고 확인하면 지출로 자동 등록 */
  async setOrderStatus(propertyId: string, userId: string, id: string, status: 'ORDERED' | 'RECEIVED' | 'CANCELLED') {
    const o = await this.prisma.purchaseOrder.findFirst({ where: { id, propertyId } });
    if (!o) throw Errors.notFound('발주');
    if (o.status === 'RECEIVED' || o.status === 'CANCELLED') throw Errors.orderClosed();
    const now = new Date();
    // 아직 열려 있을 때만 상태를 바꾸고(먼저 잡기), 입고면 같은 트랜잭션에서 지출 등록 — 두 번 눌러도 지출은 하나
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.purchaseOrder.updateMany({
        where: { id, propertyId, status: { in: ['REQUESTED', 'ORDERED'] } },
        data: {
          status,
          orderedAt: status === 'ORDERED' ? now : undefined,
          receivedAt: status === 'RECEIVED' ? now : undefined,
        },
      });
      if (claimed.count === 0) throw Errors.orderClosed();
      if (status !== 'RECEIVED') return tx.purchaseOrder.findUniqueOrThrow({ where: { id } });
      const e = await tx.expense.create({
        data: this.expenseData(
          propertyId,
          userId,
          {
            date: kstDate(now),
            vendor: o.vendor,
            category: o.category,
            amount: o.amount,
            memo: `${o.itemName} ${o.quantity}${o.unit}`,
          },
          'ORDER',
        ),
      });
      return tx.purchaseOrder.update({ where: { id }, data: { expenseId: e.id } });
    });
    return toOrder(updated);
  }
}
