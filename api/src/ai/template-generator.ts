import { Injectable } from '@nestjs/common';
import { isKorean, josa } from '../common/utils/korean.js';
import { Tone } from '../generated/prisma/enums.js';
import { ReplyGenerator, signatureFor, type GeneratedReply, type ReplyContext } from './reply-generator.js';

/** 리뷰에서 자주 나오는 주제 — 키워드 → (감사 문장, 개선 문장) */
const TOPICS: { label: string; match: RegExp; thanks: string; fix: string }[] = [
  { label: '체크인', match: /체크인|check-?in/i, thanks: '빠른 체크인', fix: '체크인 대기 시간을 줄이도록 하겠습니다' },
  { label: '친절', match: /친절|직원|staff|응대/i, thanks: '직원 응대', fix: '응대 교육을 다시 점검하겠습니다' },
  {
    label: '청결',
    match: /깨끗|청결|clean|干净/i,
    thanks: '깨끗한 객실',
    fix: '청소 상태를 다시 꼼꼼히 확인하겠습니다',
  },
  { label: '위치', match: /위치|역|가깝|location|位置/i, thanks: '편리한 위치', fix: '' },
  { label: '조식', match: /조식|아침|breakfast|早餐/i, thanks: '조식', fix: '조식 메뉴를 더 다양하게 준비하겠습니다' },
  { label: '소음', match: /소음|시끄|noise/i, thanks: '', fix: '해당 층 방음 상태를 점검하겠습니다' },
  {
    label: '엘리베이터',
    match: /엘리베이터|elevator/i,
    thanks: '',
    fix: '출근 시간대 엘리베이터 운영을 점검하겠습니다',
  },
  { label: '주차', match: /주차|parking/i, thanks: '', fix: '주차 안내를 체크인 때 더 자세히 드리겠습니다' },
  { label: '배수', match: /배수|하수|drain/i, thanks: '', fix: '해당 객실 배수 상태를 바로 점검하겠습니다' },
  { label: '침구', match: /침구|침대|bed/i, thanks: '포근한 침구', fix: '' },
];

/** 여러 표현 중 variant 번째 (다시 만들 때마다 다음 표현) */
const pick = <T>(list: readonly T[], variant: number): T => list[((variant % list.length) + list.length) % list.length];

/** ['A', 'B', 'C'] → 'A, B과 C' — 마지막 둘만 과/와로 잇는다 */
export function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  const before = items.slice(0, -2);
  const [prev, last] = items.slice(-2);
  return [...before, `${josa(prev, '과/와')} ${last}`].join(', ');
}

/**
 * ANTHROPIC_API_KEY 가 없을 때 쓰는 규칙 기반 답글 — 개발·시연용
 * - 별점 4점 이상: 사과·개선 약속 없이 감사만
 * - 별점 2점 이하: 칭찬하지 않고 사과 + 개선
 * - 한국어가 아닌 리뷰: 짧은 영어 답글
 */
@Injectable()
export class TemplateReplyGenerator extends ReplyGenerator {
  async generate(ctx: ReplyContext): Promise<GeneratedReply> {
    const hits = TOPICS.filter((t) => t.match.test(ctx.body));
    const keywords = hits.map((t) => t.label);
    const v = ctx.variant ?? 0;
    const text = isKorean(ctx.body) ? this.korean(ctx, hits, v) : this.english(ctx, v);
    return { text: `${text}\n\n${signatureFor(ctx)}`.trim(), keywords, generator: 'template' };
  }

  private korean(ctx: ReplyContext, hits: typeof TOPICS, v: number): string {
    const polite = ctx.tone === Tone.POLITE;
    const good = ctx.rating >= 3 ? hits.filter((t) => t.thanks).map((t) => t.thanks) : [];
    const fixes = ctx.rating <= 3 ? hits.filter((t) => t.fix).map((t) => t.fix) : [];
    const lines: string[] = [];

    if (ctx.rating <= 3) {
      lines.push(
        pick(
          polite
            ? [
                '편히 쉬셔야 할 시간에 불편을 드려 진심으로 죄송합니다.',
                '기대하신 만큼 편안한 시간을 드리지 못해 정말 죄송합니다.',
                '머무시는 동안 불편을 겪으셨다니 죄송한 마음입니다.',
              ]
            : ['불편하게 해 드려서 정말 죄송해요.', '편히 쉬지 못하셨다니 정말 죄송해요.'],
          v,
        ),
      );
    } else {
      lines.push(
        pick(
          polite
            ? [
                `${josa(ctx.propertyName, '을/를')} 찾아주시고 소중한 후기까지 남겨주셔서 감사합니다.`,
                `${ctx.propertyName}에 머물러 주시고 정성스러운 후기를 남겨주셔서 감사합니다.`,
                '좋은 말씀 남겨주셔서 진심으로 감사합니다.',
              ]
            : ['좋은 후기 남겨주셔서 고마워요!', '머물러 주시고 후기까지 남겨주셔서 고마워요!'],
          v,
        ),
      );
    }
    if (good.length) {
      const list = joinAnd(good);
      lines.push(
        pick(
          polite
            ? [
                `${josa(list, '을/를')} 좋게 봐주셔서 기쁩니다.`,
                `특히 ${josa(list, '을/를')} 말씀해 주셔서 힘이 납니다.`,
              ]
            : [`${list} 마음에 드셨다니 저희도 기뻐요.`, `${josa(list, '을/를')} 좋아해 주셔서 기뻐요.`],
          v,
        ),
      );
    }
    if (fixes.length) {
      lines.push(
        pick(
          polite
            ? [`말씀 주신 부분은 ${fixes.join(', ')}.`, `알려주신 내용은 ${fixes.join(', ')}.`]
            : [`말씀해 주신 건 ${fixes.join(', ')}.`, `알려주신 부분은 ${fixes.join(', ')}.`],
          v,
        ),
      );
    }
    if (ctx.mustInclude.trim()) lines.push(ctx.mustInclude.trim());
    else
      lines.push(
        pick(
          polite
            ? ['다음에도 편히 쉬어 가실 수 있도록 준비하겠습니다.', '다시 찾아주실 날을 기다리겠습니다.']
            : ['다음에도 편하게 쉬다 가세요!', '또 뵐 날을 기다릴게요!'],
          v,
        ),
      );
    return lines.join(' ');
  }

  /** 외국어 리뷰 — 짧은 영어 답글 (업장 이름·꼭 넣을 문장은 한국어일 수 있어 넣지 않는다) */
  private english(ctx: ReplyContext, v: number): string {
    if (ctx.rating >= 4) {
      return pick(
        [
          'Thank you for staying with us and for your kind review. We hope to welcome you again soon.',
          'Thank you so much for your lovely review. We look forward to having you back.',
        ],
        v,
      );
    }
    if (ctx.rating === 3) {
      return pick(
        [
          'Thank you for your feedback. We are sorry parts of your stay fell short, and we will look into what you mentioned.',
          'Thank you for sharing your experience. We apologize for the shortcomings and will review the points you raised.',
        ],
        v,
      );
    }
    return pick(
      [
        'We are truly sorry your stay did not meet your expectations. Thank you for letting us know; we will look into the issues you raised.',
        'We sincerely apologize for the inconvenience during your stay. Your feedback has been shared with our team so we can fix these issues.',
      ],
      v,
    );
  }
}
