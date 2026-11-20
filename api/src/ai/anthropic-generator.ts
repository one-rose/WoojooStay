import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { Tone } from '../generated/prisma/enums.js';
import { findBanned, ReplyGenerator, signatureFor, type GeneratedReply, type ReplyContext } from './reply-generator.js';
import { TemplateReplyGenerator } from './template-generator.js';

const SYSTEM = `당신은 한국 숙박업소 사장님을 대신해 고객 리뷰에 답글을 쓰는 담당자입니다.
규칙:
- 리뷰와 같은 언어로 쓴다 (한국어 리뷰 → 한국어, 영어 → 영어, 중국어 → 중국어).
- 리뷰에 나온 구체적인 내용(키워드)을 2~3개 짚어서 답한다. 없는 사실을 지어내지 않는다.
- 별점 3점 이하이거나 불만이 있으면 먼저 사과하고, 무엇을 어떻게 고칠지 한 문장으로 약속한다. 환불·보상은 약속하지 않는다.
- 고객 이름·연락처·직원 실명 등 개인정보는 답글에 쓰지 않는다.
- 3~5문장. 과장된 감탄사와 이모지는 쓰지 않는다.
- 마지막 줄에 서명을 그대로 붙인다.
반드시 아래 JSON 한 개만 출력한다:
{"reply": "<답글 전문>", "keywords": ["<반영한 리뷰 키워드>", ...]}`;

/** Claude API 로 답글 생성. 실패하면 템플릿 답글로 대신한다. */
@Injectable()
export class AnthropicReplyGenerator extends ReplyGenerator {
  private readonly logger = new Logger('AI');
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly fallback: TemplateReplyGenerator,
  ) {
    super();
    this.client = new Anthropic({ apiKey });
  }

  async generate(ctx: ReplyContext): Promise<GeneratedReply> {
    try {
      const first = await this.ask(ctx);
      const hit = findBanned(first.text, ctx.banned);
      if (hit.length === 0) return first;
      // 금지어가 들어가면 한 번 더 요청
      const second = await this.ask(
        ctx,
        `이전 답글에 쓰면 안 되는 단어(${hit.join(', ')})가 들어갔습니다. 빼고 다시 쓰세요.`,
      );
      return findBanned(second.text, ctx.banned).length === 0 ? second : this.fallback.generate(ctx);
    } catch (err) {
      this.logger.warn(`AI 답글 생성 실패 → 템플릿 사용: ${(err as Error).message}`);
      return this.fallback.generate(ctx);
    }
  }

  private async ask(ctx: ReplyContext, extra?: string): Promise<GeneratedReply> {
    const prompt = [
      `업장: ${ctx.propertyName} (${ctx.channelName})`,
      `말투: ${ctx.tone === Tone.POLITE ? '정중하게 (합니다체)' : '친근하게 (해요체)'}`,
      `서명: ${signatureFor(ctx)}`,
      ctx.mustInclude ? `꼭 넣을 문장: ${ctx.mustInclude}` : '',
      ctx.banned.length ? `쓰지 않을 단어: ${ctx.banned.join(', ')}` : '',
      `객실: ${ctx.roomType ?? '-'}`,
      `별점: ${ctx.rating}/5`,
      `리뷰:\n"""${ctx.body}"""`,
      extra ?? '',
    ]
      .filter(Boolean)
      .join('\n');
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = res.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as {
      reply: string;
      keywords: string[];
    };
    if (!json.reply?.trim()) throw new Error('빈 답글');
    return {
      text: json.reply.trim(),
      keywords: (json.keywords ?? []).slice(0, 5),
      generator: `anthropic:${this.model}`,
    };
  }
}
