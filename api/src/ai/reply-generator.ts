import { isKorean } from '../common/utils/korean.js';
import type { Tone } from '../generated/prisma/enums.js';

export interface ReplyContext {
  propertyName: string;
  channelName: string;
  rating: number;
  body: string;
  roomType?: string | null;
  tone: Tone;
  signature: string;
  mustInclude: string;
  banned: string[];
  /** 다시 만든 횟수 — 템플릿은 이 값으로 표현을 돌려 써서 매번 다른 문장이 나오게 한다 */
  variant?: number;
}

export interface GeneratedReply {
  text: string;
  /** 답글에 반영한 리뷰 키워드 (AI 메모) */
  keywords: string[];
  generator: string;
}

/** F1-03 AI 답글 생성 */
export abstract class ReplyGenerator {
  abstract generate(ctx: ReplyContext): Promise<GeneratedReply>;
}

/** 금지어가 들어갔는지 */
export function findBanned(text: string, banned: string[]): string[] {
  return banned.filter((w) => w.trim() && text.includes(w.trim()));
}

/**
 * 답글 끝 서명 — 한국어가 아닌 리뷰(영어·중국어 등)에 한글 서명("○○ 드림")을 붙이면 어색하므로
 * 서명에 한글이 있으면 "— 업장명" 으로 바꾼다. 한국어 리뷰이거나 서명이 이미 외국어면 그대로.
 */
export function signatureFor(ctx: Pick<ReplyContext, 'signature' | 'propertyName' | 'body'>): string {
  const sig = ctx.signature.trim();
  if (!sig || isKorean(ctx.body) || !/\p{Script=Hangul}/u.test(sig)) return sig;
  return `— ${ctx.propertyName}`;
}
