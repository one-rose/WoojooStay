/**
 * 운영자 계정 만들기
 * pnpm build && pnpm admin:create -- --email ops@woojoo.kr --name 홍길동 [--super]
 * 비밀번호는 화면에 보이지 않게 입력받는다 (환경변수 ADMIN_PASSWORD 로도 줄 수 있음)
 */
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { createAdminUser } from './admin/admin-auth.service.js';
import { ADMIN_PASSWORD } from './admin/dto/admin.dto.js';
import { PrismaService } from './prisma/prisma.service.js';

const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string' }, super: { type: 'boolean', default: false } },
});

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    out._writeToOutput = (s: string) => {
      if (s.startsWith(question)) process.stdout.write(question);
    };
  });
}

if (!values.email || !values.name) {
  console.error('사용법: pnpm admin:create -- --email <이메일> --name <이름> [--super]');
  process.exit(1);
}
const password = process.env.ADMIN_PASSWORD ?? (await askHidden('비밀번호: '));
if (!ADMIN_PASSWORD.test(password)) {
  console.error('비밀번호는 10자 이상, 영문·숫자·특수문자를 모두 넣어 주세요.');
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
try {
  const admin = await createAdminUser(app.get(PrismaService), {
    email: values.email,
    name: values.name,
    password,
    role: values.super ? 'SUPER' : 'OPERATOR',
  });
  console.log(`운영자를 만들었어요: ${admin.email} (${admin.role})`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await app.close();
}
