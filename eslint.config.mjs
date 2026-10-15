import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * 레이어 경계 규칙 (docs/ARCHITECTURE.md 참고)
 *
 *   app ──▶ ui ──▶ core ◀── infrastructure
 *    │                ▲
 *    └──▶ config ─────┘          shared ← 누구나 사용 (단, shared 는 아무것도 import 안 함)
 */
const layer = (files, banned, message) => ({
  files,
  rules: {
    "no-restricted-imports": ["error", { patterns: [{ group: banned, message }] }],
  },
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  layer(
    ["src/core/**"],
    [
      "@/infrastructure",
      "@/infrastructure/*",
      "@/ui",
      "@/ui/*",
      "@/app/*",
      "@/config/*",
      "react",
      "react-*",
      "next",
      "next/*",
    ],
    "core 는 순수 도메인입니다. React·Next·다른 레이어를 import 하지 마세요.",
  ),
  layer(
    ["src/infrastructure/**"],
    ["@/ui", "@/ui/*", "@/app/*", "react", "next", "next/*"],
    "infrastructure 는 화면(ui)·app 을 몰라야 합니다.",
  ),
  layer(
    ["src/ui/**"],
    ["@/infrastructure", "@/infrastructure/*", "@/app/*", "@/config/*"],
    "ui 는 데이터 출처를 몰라야 합니다. 필요한 값은 props 로 받으세요 (조립은 src/app 에서).",
  ),
  layer(
    ["src/shared/**"],
    ["@/core", "@/core/*", "@/infrastructure", "@/infrastructure/*", "@/ui", "@/ui/*", "@/app/*", "@/config/*"],
    "shared 는 어떤 레이어에도 의존하지 않는 순수 유틸만 둡니다.",
  ),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
