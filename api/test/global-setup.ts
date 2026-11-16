import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import pg from 'pg';

/**
 * e2e 전용 DB 준비 — 마이그레이션을 적용하고 테이블을 비운다 (기준 데이터 wj_plan 은 남김).
 * 실수로 다른 DB 를 비우지 않도록 DB 이름이 _test 로 끝날 때만 동작한다.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@localhost:5433/uzustay_test';
  if (!new URL(url).pathname.endsWith('_test')) throw new Error(`테스트 DB 이름은 _test 로 끝나야 합니다: ${url}`);
  execSync('npx prisma migrate deploy', { stdio: 'ignore', env: { ...process.env, DATABASE_URL: url } });
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const { rows } = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'wj_plan')",
  );
  if (rows.length) await client.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} CASCADE`);
  // 구독 상품 기준 데이터 (예전 실행에서 지워졌어도 다시 채움)
  await client.query(readFileSync('prisma/migrations/20261109190753_seed_plans/migration.sql', 'utf8'));
  await client.end();
}
