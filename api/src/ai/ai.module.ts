import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { AnthropicReplyGenerator } from './anthropic-generator.js';
import { ReplyGenerator } from './reply-generator.js';
import { TemplateReplyGenerator } from './template-generator.js';

/** ANTHROPIC_API_KEY 가 있으면 Claude, 없으면 템플릿 답글 */
@Global()
@Module({
  providers: [
    TemplateReplyGenerator,
    {
      provide: ReplyGenerator,
      inject: [ConfigService, TemplateReplyGenerator],
      useFactory: (config: ConfigService<Env, true>, template: TemplateReplyGenerator) => {
        const key = config.get('ANTHROPIC_API_KEY', { infer: true });
        return key ? new AnthropicReplyGenerator(key, config.get('AI_MODEL', { infer: true }), template) : template;
      },
    },
  ],
  exports: [ReplyGenerator],
})
export class AiModule {}
