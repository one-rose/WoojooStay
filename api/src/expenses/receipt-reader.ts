import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import type { ExpenseCategory } from '../generated/prisma/enums.js';
import { kstDate } from '../common/utils/dates.js';

export interface ReceiptReading {
  vendor: string | null;
  date: string | null;
  amount: number | null;
  category: ExpenseCategory | null;
}

/** 영수증 사진 → 상호·날짜·금액·분류 (F6-03). 업체(클로바 OCR 등)가 정해지면 바꿔 끼운다. */
export abstract class ReceiptReader {
  abstract read(image: Buffer, mimeType: string): Promise<ReceiptReading>;
}

/** 키가 없을 때: 날짜만 오늘로 채우고 나머지는 사장님이 입력 */
@Injectable()
export class ManualReceiptReader extends ReceiptReader {
  async read(): Promise<ReceiptReading> {
    return { vendor: null, date: kstDate(), amount: null, category: null };
  }
}

const CATEGORIES: ExpenseCategory[] = ['AMENITY', 'UTILITY', 'LAUNDRY', 'FOOD', 'REPAIR', 'TAX', 'ETC'];
const PROMPT = `숙박업소 지출 영수증 사진입니다. 아래 JSON 한 개만 출력하세요. 읽을 수 없는 값은 null.
{"vendor": "<상호>", "date": "YYYY-MM-DD", "amount": <합계 금액 숫자>, "category": "AMENITY|UTILITY|LAUNDRY|FOOD|REPAIR|TAX|ETC"}
분류: AMENITY 객실 비품·소모품, UTILITY 전기·가스·수도·통신, LAUNDRY 세탁, FOOD 식음료·조식 재료, REPAIR 수리·시설, TAX 세금·공과금, ETC 그 밖.`;

/** Claude 로 영수증 읽기. 실패하면 직접 입력으로 */
export class AnthropicReceiptReader extends ReceiptReader {
  private readonly logger = new Logger('Receipt');
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly fallback: ManualReceiptReader,
  ) {
    super();
    this.client = new Anthropic({ apiKey });
  }

  async read(image: Buffer, mimeType: string): Promise<ReceiptReading> {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)) return this.fallback.read();
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                  data: image.toString('base64'),
                },
              },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      });
      const raw = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as Record<string, unknown>;
      return {
        vendor: typeof j.vendor === 'string' ? j.vendor.slice(0, 60) : null,
        date: typeof j.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.date) ? j.date : kstDate(),
        amount: typeof j.amount === 'number' && j.amount > 0 ? Math.round(j.amount) : null,
        category: CATEGORIES.includes(j.category as ExpenseCategory) ? (j.category as ExpenseCategory) : null,
      };
    } catch (err) {
      this.logger.warn(`영수증 읽기 실패 → 직접 입력: ${(err as Error).message}`);
      return this.fallback.read();
    }
  }
}
