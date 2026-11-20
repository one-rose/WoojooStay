import { Injectable } from '@nestjs/common';
import { addDaysIso, kstDate } from '../common/utils/dates.js';
import type { Channel } from '../generated/prisma/enums.js';
import {
  ChannelAuthError,
  ChannelConnector,
  type ChannelCredentials,
  type ExternalBooking,
  type ExternalPrice,
  type ExternalRating,
  type ExternalReview,
  type ExternalSettlement,
} from './channel-connector.js';

/**
 * 실제 채널 연동 전까지 쓰는 예시 연결 — 정해진 예시 리뷰·매출·정산을 돌려준다.
 * 비밀번호가 'wrong' 이면 로그인 실패를 흉내 낸다 (테스트용).
 */

const R = (
  channel: Channel,
  id: string,
  hoursAgo: number,
  rating: number,
  author: string,
  roomType: string,
  body: string,
  photos: string[] = [],
) => ({ channel, externalId: `${channel.toLowerCase()}-${id}`, hoursAgo, rating, author, roomType, body, photos });

const REVIEWS = [
  R(
    'YANOLJA',
    'r1',
    1,
    5,
    '여행하는**',
    '디럭스 트윈',
    '늦게 도착했는데도 체크인이 정말 빨랐어요. 프런트 직원분이 근처 야식집까지 알려주셔서 감동이었습니다. 방도 깨끗하고 침구가 포근했어요!',
    ['lobby', 'room'],
  ),
  R(
    'YEOGI',
    'r2',
    3,
    4,
    '출장러',
    '스탠다드 더블',
    '출장으로 2박 했습니다. 역에서 가깝고 책상이 넓어서 일하기 좋았어요. 다만 아침에 엘리베이터 대기가 길었습니다.',
    ['cityroom'],
  ),
  R(
    'NAVER',
    'r3',
    6,
    2,
    'dlwlgus',
    '스탠다드 더블',
    '옆방 소음이 너무 커서 새벽에 몇 번이나 깼어요. 프런트에 말했는데 해결이 안 됐습니다. 위치는 좋은데 아쉽네요.',
  ),
  R(
    'AGODA',
    'r4',
    9,
    5,
    'Emily R.',
    '디럭스 트윈',
    'Great location near the subway. The breakfast had a nice selection of Korean dishes and the staff spoke good English. Would stay again!',
    ['breakfast'],
  ),
  R(
    'YANOLJA',
    'r5',
    14,
    3,
    '주말여행',
    '패밀리 스위트',
    '방은 넓고 좋았는데 화장실 배수가 느렸어요. 주차도 생각보다 좁았습니다.',
    ['hall'],
  ),
  R('TRIP', 'r6', 28, 4, '旅行者 王', '스탠다드 더블', '位置很方便，房间干净。早餐可以更丰富一些。'),
  R(
    'YEOGI',
    'r7',
    34,
    1,
    '쿠키맘',
    '디럭스 트윈',
    '직원 김OO 씨 태도가 정말 불쾌했어요. 010-1234-5678 로 연락 달라고 했는데 아무도 안 했네요.',
  ),
  R('NAVER', 'r8', 40, 5, 'hj_lee', '스탠다드 더블', '가격 대비 최고예요. 루프탑 라운지에서 본 야경이 기억에 남아요.'),
  R(
    'HOTELS',
    'r9',
    2,
    5,
    'Emily R.',
    'Deluxe Twin',
    'Great location near the station and a very clean room. Check-in was quick.',
  ),
];

/** 채널별 하루 예약매출 기준값 (원) — 오늘 날짜는 정확히 이 값 */
const DAILY: Partial<Record<Channel, number>> = {
  YANOLJA: 1_240_000,
  YEOGI: 980_000,
  NAVER: 720_000,
  AGODA: 610_000,
  TRIP: 420_000,
  HOTELS: 330_000,
  ONDA: 260_000,
  KKUL: 150_000,
  DDNAYO: 110_000,
};

/** 채널 수수료율 (예시) */
const FEE: Partial<Record<Channel, number>> = {
  YANOLJA: 0.15,
  YEOGI: 0.15,
  NAVER: 0.055,
  AGODA: 0.17,
  TRIP: 0.16,
  HOTELS: 0.17,
  ONDA: 0.1,
  KKUL: 0.12,
  DDNAYO: 0.12,
};

/** 월별 계절 계수 (1월 ~ 12월) */
const SEASON = [0.62, 0.6, 0.68, 0.74, 0.82, 0.86, 1.0, 1.06, 0.92, 1.0, 0.95, 0.9];
/** 월 광고비 (예시) — 수수료 낮은 채널은 광고비 없음 */
const AD: Partial<Record<Channel, number>> = {
  YANOLJA: 1_800_000,
  YEOGI: 1_350_000,
  NAVER: 620_000,
  AGODA: 480_000,
  TRIP: 300_000,
  HOTELS: 210_000,
  ONDA: 160_000,
};
const ROOMS = [
  { name: '스탠다드 더블', base: 89_000 },
  { name: '디럭스 트윈', base: 119_000 },
  { name: '패밀리 스위트', base: 189_000 },
];
const GUESTS = ['김*연', '이*준', '박*희', '최*우', '정*아', 'Smith J.', '王*', '한*수', '윤*지', '강*민'];
/** 대실을 파는 채널 (모텔형) */
const DAYUSE: Channel[] = ['YANOLJA', 'YEOGI'];

/** 날짜 문자열로 만드는 0~1 사이 고정 난수 (매번 같은 예시가 나오도록) */
function rand(seed: string): number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

@Injectable()
export class SampleChannelConnector extends ChannelConnector {
  readonly posted: { channel: Channel; externalId: string; text: string }[] = [];

  async verify(_channel: Channel, creds: ChannelCredentials): Promise<void> {
    if (!creds.loginId || creds.password === 'wrong') throw new ChannelAuthError('login failed');
  }

  async fetchReviews(channel: Channel, creds: ChannelCredentials, since: Date): Promise<ExternalReview[]> {
    await this.verify(channel, creds);
    const now = Date.now();
    return REVIEWS.filter((r) => r.channel === channel)
      .map((r) => ({
        externalId: r.externalId,
        author: r.author,
        rating: r.rating,
        body: r.body,
        photos: r.photos,
        roomType: r.roomType,
        stayDate: kstDate(new Date(now - (r.hoursAgo + 48) * 3_600_000)),
        postedAt: new Date(now - r.hoursAgo * 3_600_000),
      }))
      .filter((r) => r.postedAt >= since);
  }

  /** 하루 매출 합계를 예약 몇 건으로 나눈다. 오늘은 기준값 그대로, 지난날은 계절·요일·난수 반영 */
  async fetchBookings(
    channel: Channel,
    creds: ChannelCredentials,
    from: string,
    to: string,
  ): Promise<ExternalBooking[]> {
    await this.verify(channel, creds);
    const base = DAILY[channel] ?? 0;
    const today = kstDate();
    const out: ExternalBooking[] = [];
    for (let d = from; d <= to; d = addDaysIso(d, 1)) {
      const month = Number(d.slice(5, 7)) - 1;
      const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
      const total =
        d === today
          ? base
          : d === addDaysIso(today, -1)
            ? Math.round((base * 0.89) / 1000) * 1000
            : Math.round(
                (base * SEASON[month] * (dow === 5 || dow === 6 ? 1.25 : 0.92) * (0.85 + rand(channel + d) * 0.3)) /
                  1000,
              ) * 1000;
      const count = Math.max(1, Math.round(base / 160_000));
      let left = total;
      for (let i = 0; i < count; i++) {
        const amount = i === count - 1 ? left : Math.round(total / count / 1000) * 1000;
        left -= amount;
        const dayuse = DAYUSE.includes(channel) && i === 0 && count > 2;
        const room = ROOMS[Math.floor(rand(`${channel}${d}${i}r`) * ROOMS.length)];
        out.push({
          reservationNo: `${channel.slice(0, 2)}${d.replaceAll('-', '')}${String(i).padStart(2, '0')}`,
          guestName: GUESTS[Math.floor(rand(`${channel}${d}${i}g`) * GUESTS.length)],
          roomType: room.name,
          stayType: dayuse ? 'DAYUSE' : 'OVERNIGHT',
          checkinDate: d,
          checkoutDate: dayuse ? d : addDaysIso(d, 1),
          checkinTime: dayuse
            ? `${String(11 + Math.floor(rand(`${channel}${d}t`) * 10)).padStart(2, '0')}:00`
            : undefined,
          saleAmount: amount,
          discount: 0,
          commission: Math.round(amount * (FEE[channel] ?? 0.12)),
          status: 'CONFIRMED',
          bookedAt: new Date(`${addDaysIso(d, -Math.floor(rand(`${channel}${d}${i}b`) * 10))}T03:00:00Z`),
        });
      }
    }
    return out;
  }

  async fetchSettlements(channel: Channel, creds: ChannelCredentials, from: string): Promise<ExternalSettlement[]> {
    await this.verify(channel, creds);
    const base = DAILY[channel] ?? 0;
    const offset = Object.keys(DAILY).indexOf(channel) + 1;
    const amount = Math.round((base * 2.5) / 10_000) * 10_000;
    return [
      { date: addDaysIso(from, offset - 8), amount: Math.round((amount * 0.94) / 10_000) * 10_000, settled: true },
      { date: addDaysIso(from, offset), amount, settled: false },
      { date: addDaysIso(from, offset + 7), amount: Math.round((amount * 1.05) / 10_000) * 10_000, settled: false },
    ];
  }

  async fetchPrices(channel: Channel, creds: ChannelCredentials, dates: string[]): Promise<ExternalPrice[]> {
    await this.verify(channel, creds);
    // 수수료가 낮은 채널일수록 조금 싸게 노출된다고 가정
    const markup = 1 + (FEE[channel] ?? 0.12) * 0.5;
    return dates.flatMap((date) => {
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      const weekend = dow === 5 || dow === 6 ? 1.4 : 1;
      return ROOMS.map((r) => ({
        roomType: r.name,
        date,
        price: Math.round((r.base * weekend * markup) / 1000) * 1000,
      }));
    });
  }

  async fetchAdSpend(channel: Channel, creds: ChannelCredentials, month: string): Promise<number | null> {
    await this.verify(channel, creds);
    const base = AD[channel];
    if (base === undefined) return null;
    return Math.round((base * SEASON[Number(month.slice(5, 7)) - 1]) / 10_000) * 10_000;
  }

  async postReply(channel: Channel, creds: ChannelCredentials, externalId: string, text: string): Promise<void> {
    await this.verify(channel, creds);
    this.posted.push({ channel, externalId, text });
  }

  /** 채널마다 4.1~4.8 사이 고정값에 날짜별로 ±0.05 흔들림, 리뷰 수는 채널 크기에 비례 */
  async fetchRating(channel: Channel, creds: ChannelCredentials): Promise<ExternalRating | null> {
    await this.verify(channel, creds);
    const base = 4.1 + rand(`rating-${channel}`) * 0.7;
    const wobble = (rand(`rating-${channel}-${kstDate()}`) - 0.5) * 0.1;
    const rating = Math.round(Math.min(5, Math.max(1, base + wobble)) * 100) / 100;
    const reviewCount = Math.round((DAILY[channel] ?? 100_000) / 1_000 + rand(`count-${channel}`) * 200);
    return { rating, reviewCount };
  }
}
