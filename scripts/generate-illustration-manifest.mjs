#!/usr/bin/env node
/**
 * src/assets/illustrations/<시안>/<이름>.webp 를 훑어서
 * src/ui/media/illustration-manifest.ts 를 다시 만든다.
 *
 * 사용: pnpm gen:illustrations
 * 일러스트를 추가·교체한 뒤 실행하고, 새 이름이면 core 의 IllustrationId 에도 추가하세요.
 */
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ASSET_DIR = join(ROOT, "src/assets/illustrations");
const OUT = join(ROOT, "src/ui/media/illustration-manifest.ts");
const SCHEMES = ["purple", "a", "b", "c", "d", "e"];

const names = readdirSync(join(ASSET_DIR, SCHEMES[0]))
  .filter((file) => file.endsWith(".webp"))
  .map((file) => file.replace(/\.webp$/, ""))
  .sort();

for (const scheme of SCHEMES) {
  const files = new Set(readdirSync(join(ASSET_DIR, scheme)));
  const missing = names.filter((name) => !files.has(`${name}.webp`));
  if (missing.length) throw new Error(`[${scheme}] 일러스트 누락: ${missing.join(", ")}`);
}

const ident = (scheme, name) => `${scheme}_${name.replace(/-/g, "_")}`;

const lines = [
  "// 시안별 일러스트 이미지 목록 (scripts/generate-illustration-manifest.mjs 로 생성 — 직접 수정하지 마세요)",
  'import type { StaticImageData } from "next/image";',
  'import type { IllustrationId, SchemeId } from "@/core";',
  "",
  ...SCHEMES.flatMap((scheme) =>
    names.map((name) => `import ${ident(scheme, name)} from "@/assets/illustrations/${scheme}/${name}.webp";`),
  ),
  "",
  "export const ILLUSTRATIONS: Record<SchemeId, Record<IllustrationId, StaticImageData>> = {",
  ...SCHEMES.flatMap((scheme) => [
    `  ${scheme}: {`,
    ...names.map((name) => `    "${name}": ${ident(scheme, name)},`),
    "  },",
  ]),
  "};",
  "",
];

writeFileSync(OUT, lines.join("\n"));
console.log(`illustration-manifest.ts: ${SCHEMES.length}개 시안 × ${names.length}개 일러스트`);
