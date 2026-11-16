import type { Channel } from '../generated/prisma/enums.js';

/** 채널 파트너센터 로그인 정보 — DB 에는 암호화해서만 저장 */
export interface ChannelCredentials {
  loginId: string;
  password: string;
}

export interface ExternalReview {
  externalId: string;
  author: string;
  rating: number;
  body: string;
  photos: string[];
  roomType?: string;
  stayDate?: string;
  postedAt: Date;
  /** 채널에 이미 답글이 달려 있으면 */
  existingReply?: string;
}

export interface ExternalBooking {
  reservationNo: string;
  guestName: string;
  roomType: string;
  stayType: 'OVERNIGHT' | 'DAYUSE';
  checkinDate: string;
  checkoutDate: string;
  /** 대실 입실 "HH:mm" */
  checkinTime?: string;
  saleAmount: number;
  discount: number;
  commission: number;
  status: 'CONFIRMED' | 'CANCELLED' | 'NOSHOW';
  bookedAt: Date;
}

export interface ExternalSettlement {
  date: string;
  amount: number;
  settled: boolean;
}

export interface ExternalPrice {
  roomType: string;
  date: string;
  price: number;
}

export class ChannelAuthError extends Error {}

/**
 * 채널 하나와 주고받는 방법. 채널별 연동 방식(API · 계정 위탁)이 정해지면
 * 채널마다 이 클래스를 구현해 ConnectorRegistry 에 등록한다. (F0-04 ~ F0-07, F1-07)
 */
export abstract class ChannelConnector {
  abstract verify(channel: Channel, creds: ChannelCredentials): Promise<void>;
  abstract fetchReviews(channel: Channel, creds: ChannelCredentials, since: Date): Promise<ExternalReview[]>;
  /** 투숙일(checkin)이 from~to 인 예약 */
  abstract fetchBookings(
    channel: Channel,
    creds: ChannelCredentials,
    from: string,
    to: string,
  ): Promise<ExternalBooking[]>;
  /** from 이후 정산 예정 + 최근 정산 완료 */
  abstract fetchSettlements(channel: Channel, creds: ChannelCredentials, from: string): Promise<ExternalSettlement[]>;
  /** 채널에 노출되는 우리 판매가 (F2-05) */
  abstract fetchPrices(channel: Channel, creds: ChannelCredentials, dates: string[]): Promise<ExternalPrice[]>;
  /** 그 달 광고비. 채널이 주지 않으면 null (직접 입력) */
  abstract fetchAdSpend(channel: Channel, creds: ChannelCredentials, month: string): Promise<number | null>;
  abstract postReply(channel: Channel, creds: ChannelCredentials, externalId: string, text: string): Promise<void>;
}
