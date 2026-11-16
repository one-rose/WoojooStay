import { Channel } from '../generated/prisma/enums.js';

export type ReplyMode = 'API' | 'COPY';

/**
 * 채널 목록 — 랜딩·기능정의서의 9개 채널
 * replyMode: 공식 답글 API 가 확인된 채널만 API (자동 게시·자동 응대 대상).
 * 조사(26-11-10) 기준 Expedia(호텔스닷컴) Reviews API(setReviewResponse) 만 확인됨 — 나머지는 사장님이 복사해서 게시.
 * 다른 채널도 공식 API 가 확인되면 여기서 API 로 바꾼다.
 */
export const CHANNEL_CATALOG: Record<Channel, { name: string; replyMode: ReplyMode; partnerUrl: string }> = {
  YANOLJA: { name: '야놀자', replyMode: 'COPY', partnerUrl: 'https://partner.yanolja.com' },
  YEOGI: { name: '여기어때', replyMode: 'COPY', partnerUrl: 'https://partner.goodchoice.kr' },
  NAVER: { name: '네이버', replyMode: 'COPY', partnerUrl: 'https://partner.booking.naver.com' },
  AGODA: { name: '아고다', replyMode: 'COPY', partnerUrl: 'https://ycs.agoda.com' },
  TRIP: { name: '트립닷컴', replyMode: 'COPY', partnerUrl: 'https://ebooking.trip.com' },
  HOTELS: { name: '호텔스닷컴', replyMode: 'API', partnerUrl: 'https://apps.expediapartnercentral.com' },
  ONDA: { name: '온다', replyMode: 'COPY', partnerUrl: 'https://www.onda.me' },
  KKUL: { name: '꿀스테이', replyMode: 'COPY', partnerUrl: 'https://www.coolstay.co.kr' },
  DDNAYO: { name: '떠나요', replyMode: 'COPY', partnerUrl: 'https://www.ddnayo.com' },
};

export const CHANNELS = Object.keys(CHANNEL_CATALOG) as Channel[];
