import { Injectable } from '@nestjs/common';

export interface CompetitorQuote {
  name: string;
  distanceM: number;
  roomType: string;
  date: string;
  price: number;
}

/** 주변 경쟁 업소 가격 — 수집 방법이 정해지면 교체 (기능정의서 F2-05 '경쟁 업소 가격 수집 가능 여부') */
export abstract class CompetitorSource {
  abstract quotes(address: string, roomType: string, dates: string[]): Promise<CompetitorQuote[]>;
}

const SAMPLE = [
  { name: '을지 시티호텔', distanceM: 350, factor: 0.92 },
  { name: '호텔 청계 리버', distanceM: 600, factor: 1.09 },
  { name: '명동 스테이K', distanceM: 900, factor: 0.98 },
];

@Injectable()
export class SampleCompetitorSource extends CompetitorSource {
  async quotes(_address: string, roomType: string, dates: string[]): Promise<CompetitorQuote[]> {
    return dates.flatMap((date) => {
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      const base = (dow === 5 || dow === 6 ? 1.4 : 1) * 92_000;
      return SAMPLE.map((c) => ({
        name: c.name,
        distanceM: c.distanceM,
        roomType,
        date,
        price: Math.round((base * c.factor) / 1000) * 1000,
      }));
    });
  }
}
