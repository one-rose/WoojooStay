import { Injectable } from '@nestjs/common';
import { Errors } from '../common/errors/app-error.js';
import { addDaysIso, dateOnly, kstDate } from '../common/utils/dates.js';
import type { OpsNote, Room } from '../generated/prisma/client.js';
import { OpsNoteKind, Role, RoomStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { OpsNoteDto, RoomDto, RoomStatusDto } from './ops.dto.js';

const STATUS_ORDER: RoomStatus[] = [
  RoomStatus.DIRTY,
  RoomStatus.CLEANING,
  RoomStatus.INSPECT,
  RoomStatus.READY,
  RoomStatus.OCCUPIED,
  RoomStatus.OUT_OF_ORDER,
];
/** 인수인계는 최근 7일만 판에 보여준다 */
const HANDOVER_DAYS = 7;
const isLead = (role: Role) => role === Role.OWNER || role === Role.MANAGER;

type NoteRow = OpsNote & {
  author: { name: string } | null;
  reads: { userId: string; readAt: Date; user: { name: string } }[];
};

const toRoom = (r: Room, names: Map<string, string>) => ({
  id: r.id,
  number: r.number,
  floor: r.floor,
  roomType: r.roomType,
  status: r.status,
  memo: r.memo,
  changedAt: r.statusChangedAt,
  changedBy: r.statusChangedById ? (names.get(r.statusChangedById) ?? null) : null,
});

const toNote = (n: NoteRow, me: string) => ({
  id: n.id,
  kind: n.kind,
  shift: n.shift,
  body: n.body,
  pinned: n.isPinned,
  author: n.author?.name ?? '(탈퇴한 사용자)',
  isMine: n.authorId === me,
  createdAt: n.createdAt,
  readByMe: n.reads.some((r) => r.userId === me),
  readers: n.reads.map((r) => ({ name: r.user.name, readAt: r.readAt })),
});

/** 현장 업무 — 객실 상태판(F7-01) · 인수인계(F7-02) · 공지(F7-03) */
@Injectable()
export class OpsService {
  constructor(private readonly prisma: PrismaService) {}

  async board(propertyId: string, userId: string, role: Role) {
    const today = kstDate();
    const since = dateOnly(addDaysIso(today, -(HANDOVER_DAYS - 1)));
    const noteInclude = {
      author: { select: { name: true } },
      reads: { select: { userId: true, readAt: true, user: { select: { name: true } } }, orderBy: { readAt: 'asc' } },
    } as const;
    const [rooms, notices, handovers, memberCount] = await Promise.all([
      this.prisma.room.findMany({
        where: { propertyId },
        orderBy: [{ sortOrder: 'asc' }, { floor: 'asc' }, { number: 'asc' }],
      }),
      this.prisma.opsNote.findMany({
        where: { propertyId, kind: OpsNoteKind.NOTICE },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: 20,
        include: noteInclude,
      }),
      this.prisma.opsNote.findMany({
        where: {
          propertyId,
          kind: OpsNoteKind.HANDOVER,
          createdAt: { gte: new Date(since.getTime() - 9 * 3_600_000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: noteInclude,
      }),
      this.prisma.membership.count({ where: { propertyId } }),
    ]);
    const names = await this.userNames(rooms.map((r) => r.statusChangedById));
    const counts = Object.fromEntries(
      STATUS_ORDER.map((s) => [s, rooms.filter((r) => r.status === s).length]),
    ) as Record<RoomStatus, number>;
    const notes = [...notices, ...handovers].map((n) => toNote(n, userId));
    return {
      date: today,
      myRole: role,
      memberCount,
      counts,
      rooms: rooms.map((r) => toRoom(r, names)),
      notices: notes.filter((n) => n.kind === OpsNoteKind.NOTICE),
      handovers: notes.filter((n) => n.kind === OpsNoteKind.HANDOVER),
      unread: notes.filter((n) => !n.readByMe).length,
    };
  }

  /* ── 객실 ── */

  async addRooms(propertyId: string, rooms: RoomDto[]) {
    const numbers = rooms.map((r) => r.number.trim());
    const dup = numbers.find((n, i) => numbers.indexOf(n) !== i);
    if (dup) throw Errors.roomNoTaken(dup);
    const taken = await this.prisma.room.findFirst({ where: { propertyId, number: { in: numbers } } });
    if (taken) throw Errors.roomNoTaken(taken.number);
    const last = await this.prisma.room.aggregate({ where: { propertyId }, _max: { sortOrder: true } });
    const base = (last._max.sortOrder ?? -1) + 1;
    await this.prisma.room.createMany({
      data: rooms.map((r, i) => ({
        propertyId,
        number: numbers[i],
        floor: r.floor ?? null,
        roomType: r.roomType?.trim() || null,
        sortOrder: base + i,
      })),
    });
    return { added: rooms.length };
  }

  async updateRoom(propertyId: string, roomId: string, dto: RoomDto) {
    await this.room(propertyId, roomId);
    const number = dto.number.trim();
    const taken = await this.prisma.room.findFirst({ where: { propertyId, number, id: { not: roomId } } });
    if (taken) throw Errors.roomNoTaken(number);
    const r = await this.prisma.room.update({
      where: { id: roomId },
      data: { number, floor: dto.floor ?? null, roomType: dto.roomType?.trim() || null },
    });
    return toRoom(r, new Map());
  }

  async removeRoom(propertyId: string, roomId: string) {
    await this.room(propertyId, roomId);
    await this.prisma.room.delete({ where: { id: roomId } });
  }

  /** 상태 바꾸기 — 직원도 가능, 판매 중지(고장)는 사장님·매니저만 걸고 풀 수 있다 */
  async setStatus(propertyId: string, roomId: string, user: { id: string; role: Role }, dto: RoomStatusDto) {
    const room = await this.room(propertyId, roomId);
    if (dto.expectedStatus && dto.expectedStatus !== room.status) throw Errors.roomStatusConflict();
    const touchesLock = room.status === RoomStatus.OUT_OF_ORDER || dto.status === RoomStatus.OUT_OF_ORDER;
    if (touchesLock && room.status !== dto.status && !isLead(user.role)) throw Errors.roomLocked();
    const memo = dto.memo?.trim() || null;
    const changed = room.status !== dto.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      // 내가 본 상태 그대로일 때만 바꾼다 — 그사이 다른 사람이 바꿨으면 409 (덮어쓰지 않음)
      const r = await tx.room.updateMany({
        where: { id: roomId, status: room.status },
        data: changed
          ? { status: dto.status, memo, statusChangedAt: new Date(), statusChangedById: user.id }
          : { memo },
      });
      if (r.count === 0) throw Errors.roomStatusConflict();
      if (changed) {
        await tx.roomStatusLog.create({
          data: { roomId, fromStatus: room.status, toStatus: dto.status, memo, changedById: user.id },
        });
      }
      return tx.room.findUniqueOrThrow({ where: { id: roomId } });
    });
    return toRoom(updated, await this.userNames([updated.statusChangedById]));
  }

  async roomLogs(propertyId: string, roomId: string) {
    await this.room(propertyId, roomId);
    const logs = await this.prisma.roomStatusLog.findMany({
      where: { roomId },
      orderBy: { changedAt: 'desc' },
      take: 30,
      include: { changedBy: { select: { name: true } } },
    });
    return logs.map((l) => ({
      from: l.fromStatus,
      to: l.toStatus,
      memo: l.memo,
      by: l.changedBy?.name ?? null,
      at: l.changedAt,
    }));
  }

  /* ── 인수인계 · 공지 ── */

  async createNote(propertyId: string, user: { id: string; role: Role }, dto: OpsNoteDto) {
    if (dto.kind === OpsNoteKind.NOTICE && !isLead(user.role)) throw Errors.forbidden();
    const note = await this.prisma.opsNote.create({
      data: {
        propertyId,
        kind: dto.kind,
        body: dto.body.trim(),
        shift: dto.kind === OpsNoteKind.HANDOVER ? (dto.shift ?? null) : null,
        isPinned: dto.kind === OpsNoteKind.NOTICE && !!dto.pinned,
        authorId: user.id,
        reads: { create: { userId: user.id } }, // 쓴 사람은 읽은 것으로
      },
      include: {
        author: { select: { name: true } },
        reads: { select: { userId: true, readAt: true, user: { select: { name: true } } } },
      },
    });
    return toNote(note, user.id);
  }

  async markRead(propertyId: string, noteId: string, userId: string) {
    await this.note(propertyId, noteId);
    await this.prisma.opsNoteRead.upsert({
      where: { noteId_userId: { noteId, userId } },
      create: { noteId, userId },
      update: {},
    });
  }

  async pin(propertyId: string, noteId: string, pinned: boolean) {
    const n = await this.note(propertyId, noteId);
    if (n.kind !== OpsNoteKind.NOTICE) throw Errors.notFound('공지');
    await this.prisma.opsNote.update({ where: { id: noteId }, data: { isPinned: pinned } });
  }

  /** 지우기 — 쓴 사람 또는 사장님·매니저 */
  async removeNote(propertyId: string, noteId: string, user: { id: string; role: Role }) {
    const n = await this.note(propertyId, noteId);
    if (n.authorId !== user.id && !isLead(user.role)) throw Errors.forbidden();
    await this.prisma.opsNote.delete({ where: { id: noteId } });
  }

  private async room(propertyId: string, roomId: string) {
    const room = await this.prisma.room.findFirst({ where: { id: roomId, propertyId } });
    if (!room) throw Errors.notFound('객실');
    return room;
  }

  private async note(propertyId: string, noteId: string) {
    const note = await this.prisma.opsNote.findFirst({ where: { id: noteId, propertyId } });
    if (!note) throw Errors.notFound('글');
    return note;
  }

  private async userNames(ids: (string | null)[]) {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    if (!unique.length) return new Map<string, string>();
    const users = await this.prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
    return new Map(users.map((u) => [u.id, u.name]));
  }
}
