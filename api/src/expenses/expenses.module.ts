import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { ExpensesController } from './expenses.controller.js';
import { ExpensesService } from './expenses.service.js';
import { AnthropicReceiptReader, ManualReceiptReader, ReceiptReader } from './receipt-reader.js';

@Module({
  controllers: [ExpensesController],
  providers: [
    ExpensesService,
    ManualReceiptReader,
    {
      provide: ReceiptReader,
      inject: [ConfigService, ManualReceiptReader],
      useFactory: (config: ConfigService<Env, true>, manual: ManualReceiptReader) => {
        const key = config.get('ANTHROPIC_API_KEY', { infer: true });
        return key ? new AnthropicReceiptReader(key, config.get('AI_MODEL', { infer: true }), manual) : manual;
      },
    },
  ],
})
export class ExpensesModule {}
