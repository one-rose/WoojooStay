import { Injectable, Logger } from '@nestjs/common';
import { Errors } from '../common/errors/app-error.js';
import { addDaysIso, dateOnly, kstDate } from '../common/utils/dates.js';
import { CHANNEL_CATALOG, CHANNELS } from '../connectors/catalog.js';
import { ChannelAuthError, ChannelConnector } from '../connectors/channel-connector.js';
import { CompetitorSource } from '../connectors/competitor-source.js';
import { CredentialVault } from '../connectors/credential-vault.js';
import { ConnectionStatus, type Channel } from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReviewIngestService } from '../reviews/review-ingest.service.js';
import type { ConnectChannelDto } from './dto/connect.dto.js';

const FIRST_SYNC_DAYS = 90;

const nextMonth = (iso: string) => {
  const [y, m] = iso.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
};
const MAX_FAILS = 3;

/** F0-04 채널 연동 · F0-05~07 수집 */
@Injectable()
export class ChannelsService {
  private readonly logger = new Logger('Channels');

  constructor(
    private readonly prisma: PrismaService,
    private readonly connector: ChannelConnector,
    private readonly vault: CredentialVault,
    private readonly ingest: ReviewIngestService,
    private readonly notifications: NotificationsService,
    private readonly competitors: CompetitorSource,
  ) {}

  /** 9개 채널 전부 — 연결 안 된 채널도 함께 */
  async list(propertyId: string) {
    const rows = await this.prisma.channelConnection.findMany({ where: { propertyId } });
    return CHANNELS.map((channel) => {
      const c = rows.find((r) => r.channel === channel);
      return {
        channel,
        name: CHANNEL_CATALOG[channel].name,
        replyMode: CHANNEL_CATALOG[channel].replyMode,
        connected: !!c,
        status: c?.status ?? null,
        lastSyncedAt: c?.lastSyncedAt ?? null,
        lastError: c?.lastError ?? null,
      };
    });
  }

  /** 로그인 확인 → 암호화 저장 → 최근 90일 첫 수집 */
  async connect(propertyId: string, channel: Channel, dto: ConnectChannelDto) {
    if (!dto.consent) throw Errors.consentRequired();
    const creds = { loginId: dto.loginId, password: dto.password };
    try {
      await this.connector.verify(channel, creds);
    } catch (err) {
      if (err instanceof ChannelAuthError) throw Errors.channelAuthFailed(CHANNEL_CATALOG[channel].name);
      throw err;
    }
    const sealed = this.vault.seal(creds);
    await this.prisma.channelConnection.upsert({
      where: { propertyId_channel: { propertyId, channel } },
      create: { propertyId, channel, credentials: sealed, consentAt: new Date(), status: ConnectionStatus.SYNCING },
      update: {
        credentials: sealed,
        consentAt: new Date(),
        status: ConnectionStatus.SYNCING,
        consecutiveFails: 0,
        lastError: null,
      },
    });
    const result = await this.sync(propertyId, channel, FIRST_SYNC_DAYS);
    await this.refreshCompetitors(propertyId);
    return result;
  }

  /** 주변 경쟁 업소 가격 (F2-05) — 앞으로 14일 */
  async refreshCompetitors(propertyId: string) {
    const property = await this.prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
    const today = kstDate();
    const dates = Array.from({ length: 14 }, (_, i) => addDaysIso(today, i));
    const quotes = await this.competitors.quotes(property.address, '스탠다드 더블', dates);
    for (const q of quotes) {
      // 한 건이 잘못돼도 나머지는 저장
      await this.prisma.competitorPrice
        .upsert({
          where: {
            propertyId_name_roomType_stayDate: {
              propertyId,
              name: q.name,
              roomType: q.roomType,
              stayDate: dateOnly(q.date),
            },
          },
          create: {
            propertyId,
            name: q.name,
            distanceM: q.distanceM,
            roomType: q.roomType,
            stayDate: dateOnly(q.date),
            price: q.price,
          },
          update: { price: q.price, collectedAt: new Date() },
        })
        .catch((err: Error) => this.logger.warn(`경쟁 업소 가격 저장 실패 ${propertyId}/${q.name}: ${err.message}`));
    }
  }

  async disconnect(propertyId: string, channel: Channel) {
    await this.prisma.channelConnection.deleteMany({ where: { propertyId, channel } });
  }

  /**
   * 한 채널 수집. 실패가 3번 이어지면 '오류'로 바꾸고 알린다 (F0-05 예외 처리)
   * 같은 업장·채널 수집은 한 번에 하나만 — 이미 수집 중이면 기다리지 않고 inProgress 로 돌려준다.
   */
  async sync(propertyId: string, channel: Channel, days = 2) {
    const conn = await this.prisma.channelConnection.findUnique({
      where: { propertyId_channel: { propertyId, channel } },
    });
    if (!conn) throw Errors.channelNotConnected();
    const result = await this.prisma.tryLock(`sync:${propertyId}:${channel}`, () =>
      this.syncLocked(propertyId, channel, days),
    );
    return result ?? { channel, status: conn.status, newReviews: 0, inProgress: true };
  }

  private async syncLocked(propertyId: string, channel: Channel, days: number) {
    // 잠금을 잡은 뒤 다시 읽는다 (앞 수집이 바꾼 lastSyncedAt·실패 횟수)
    const conn = await this.prisma.channelConnection.findUnique({
      where: { propertyId_channel: { propertyId, channel } },
    });
    if (!conn) throw Errors.channelNotConnected();
    const creds = this.vault.open(conn.credentials);
    const today = kstDate();
    const since =
      conn.lastSyncedAt && days <= 2
        ? new Date(conn.lastSyncedAt.getTime() - 3_600_000)
        : new Date(Date.now() - days * 86_400_000);
    try {
      const from = addDaysIso(today, -days);
      const priceDates = Array.from({ length: 14 }, (_, i) => addDaysIso(today, i));
      const [reviews, bookings, settlements, prices] = await Promise.all([
        this.connector.fetchReviews(channel, creds, since),
        this.connector.fetchBookings(channel, creds, from, addDaysIso(today, 14)),
        this.connector.fetchSettlements(channel, creds, today),
        this.connector.fetchPrices(channel, creds, priceDates),
      ]);
      const { created } = await this.ingest.ingest(propertyId, channel, reviews);
      // 한 번에 묶어서 저장 (첫 수집은 수천 건)
      const upserts = bookings.map((b) => {
        const data = {
          guestName: b.guestName,
          roomType: b.roomType,
          stayType: b.stayType,
          checkinDate: dateOnly(b.checkinDate),
          checkoutDate: dateOnly(b.checkoutDate),
          checkinTime: b.checkinTime ?? null,
          saleAmount: b.saleAmount,
          discount: b.discount,
          commission: b.commission,
          status: b.status,
          bookedAt: b.bookedAt,
        };
        return this.prisma.booking.upsert({
          where: { propertyId_channel_reservationNo: { propertyId, channel, reservationNo: b.reservationNo } },
          create: { propertyId, channel, reservationNo: b.reservationNo, ...data },
          update: data,
        });
      });
      for (let i = 0; i < upserts.length; i += 500) await this.prisma.$transaction(upserts.slice(i, i + 500));
      // 정산: 아직 안 들어온 예정분은 새로 받은 값으로 바꾸고, 완료분은 없을 때만 추가 — 한 트랜잭션으로
      const settledDays = new Set(
        (
          await this.prisma.settlement.findMany({
            where: { propertyId, channel, settled: true },
            select: { expectedDate: true },
          })
        ).map((s) => s.expectedDate.getTime()),
      );
      const fresh = settlements.filter((st) => !st.settled || !settledDays.has(dateOnly(st.date).getTime()));
      await this.prisma.$transaction([
        this.prisma.settlement.deleteMany({ where: { propertyId, channel, settled: false } }),
        this.prisma.settlement.createMany({
          data: fresh.map((st) => ({
            propertyId,
            channel,
            expectedDate: dateOnly(st.date),
            amount: st.amount,
            settled: st.settled,
          })),
        }),
      ]);
      for (const pr of prices) {
        await this.prisma.channelPrice.upsert({
          where: {
            propertyId_channel_roomType_stayDate: {
              propertyId,
              channel,
              roomType: pr.roomType,
              stayDate: dateOnly(pr.date),
            },
          },
          create: { propertyId, channel, roomType: pr.roomType, stayDate: dateOnly(pr.date), price: pr.price },
          update: { price: pr.price, collectedAt: new Date() },
        });
      }
      // 광고비: 수집 기간에 걸친 달마다
      for (let m = `${from.slice(0, 7)}-01`; m <= today; m = nextMonth(m)) {
        const amount = await this.connector.fetchAdSpend(channel, creds, m);
        if (amount === null) continue;
        const key = { propertyId_channel_month: { propertyId, channel, month: dateOnly(m) } };
        // 사장님이 직접 넣은 광고비(MANUAL)는 채널 값으로 덮어쓰지 않는다
        const current = await this.prisma.adSpend.findUnique({ where: key, select: { source: true } });
        if (current?.source === 'MANUAL') continue;
        await this.prisma.adSpend.upsert({
          where: key,
          create: { propertyId, channel, month: dateOnly(m), amount, source: 'CHANNEL' },
          update: { amount, source: 'CHANNEL' },
        });
      }
      await this.prisma.channelConnection.update({
        where: { id: conn.id },
        data: { status: ConnectionStatus.CONNECTED, lastSyncedAt: new Date(), consecutiveFails: 0, lastError: null },
      });
      return { channel, status: ConnectionStatus.CONNECTED, newReviews: created };
    } catch (err) {
      const auth = err instanceof ChannelAuthError;
      const fails = conn.consecutiveFails + 1;
      const status = auth ? ConnectionStatus.AUTH_EXPIRED : fails >= MAX_FAILS ? ConnectionStatus.ERROR : conn.status;
      await this.prisma.channelConnection.update({
        where: { id: conn.id },
        data: { status, consecutiveFails: fails, lastError: (err as Error).message.slice(0, 300) },
      });
      if ((auth || fails === MAX_FAILS) && conn.status !== status) {
        await this.notifications.notifyProperty(
          propertyId,
          'SYNC',
          `${CHANNEL_CATALOG[channel].name} 연동이 끊겼어요. 다시 로그인해 주세요.`,
          '/app/settings/channels',
          { urgent: true },
        );
      }
      this.logger.warn(`수집 실패 ${propertyId}/${channel}: ${(err as Error).message}`);
      return { channel, status, newReviews: 0 };
    }
  }

  /** 정기 수집 — 연결된 모든 채널 (오류 상태 제외) */
  async syncAll() {
    const conns = await this.prisma.channelConnection.findMany({
      where: { status: { in: [ConnectionStatus.CONNECTED, ConnectionStatus.SYNCING] } },
    });
    // 한 곳이 실패해도 나머지는 계속 수집한다
    for (const c of conns) {
      try {
        await this.sync(c.propertyId, c.channel);
      } catch (err) {
        this.logger.error(`정기 수집 오류 ${c.propertyId}/${c.channel}: ${(err as Error).message}`);
      }
    }
    for (const id of new Set(conns.map((c) => c.propertyId))) {
      try {
        await this.refreshCompetitors(id);
      } catch (err) {
        this.logger.error(`경쟁 업소 가격 수집 오류 ${id}: ${(err as Error).message}`);
      }
    }
    return conns.length;
  }
}
