#!/usr/bin/env node
/**
 * 화면 규칙 10가지 검사 (docs/PMS-UI-RULES.md) — 앱 관리화면 CSS(src/ui/pms)에서 기계로 찾을 수 있는 것만.
 * pnpm check 에서 돈다. 정당한 예외는 줄 끝에 `/* ui-ok: 이유 *\/` 를 붙인다.
 *
 * 찾는 것
 * - 3: 색을 #hex · rgb() · rgba() · hsl() 로 씀 → oklch()
 * - 4: 그라데이션에 `in oklch` 가 없음
 * - 2: 테두리를 불투명 회색으로 씀 → var(--pm-line*) (반투명) 또는 상태색 토큰
 * - 9: 100vh → 100dvh
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIRS = ["src/ui/pms"];

const RULES = [
  { id: "3-oklch", msg: "색은 oklch() 로 (규칙 3)", re: /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/ },
  {
    id: "4-gradient",
    msg: "그라데이션은 `in oklch` 로 (규칙 4)",
    re: /(?:repeating-)?(?:linear|radial|conic)-gradient\((?![^;]*\bin oklch\b)/,
    multiline: true,
  },
  {
    id: "2-border",
    msg: "테두리는 반투명 var(--pm-line*) 로 — 불투명 회색 금지 (규칙 2)",
    // border 선언에 채도 낮은(회색) 불투명 oklch 가 직접 들어감
    re: /\bborder(?:-(?:top|right|bottom|left|inline|block))?(?:-color)?\s*:[^;]*oklch\([\d.]+%\s+0\.0[0-2]\d\s+[\d.]+\)/,
  },
  { id: "9-dvh", msg: "화면 높이는 100dvh (규칙 9)", re: /\b100vh\b/ },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".css")) out.push(p);
  }
  return out;
}

const problems = [];
for (const d of DIRS) {
  for (const file of walk(join(ROOT, d))) {
    const text = readFileSync(file, "utf8");
    const rel = relative(ROOT, file);
    // 주석을 지우되 줄 번호는 유지
    const code = text.replace(/\/\*[\s\S]*?\*\//g, (m) =>
      m.includes("ui-ok") ? "/*ui-ok*/" : m.replace(/[^\n]/g, " "),
    );
    const lines = code.split("\n");
    for (const rule of RULES) {
      if (rule.multiline) {
        // 여러 줄에 걸친 그라데이션: 선언 끝(;)까지 이어 붙여서 본다
        const flat = code.replace(/\n\s*/g, " ");
        const re = new RegExp(rule.re.source, "g");
        let m;
        while ((m = re.exec(flat))) {
          const before = flat.slice(0, m.index);
          const line = (text.slice(0, text.length).split("\n").length && before.split("\n").length) || 1;
          // 줄 번호 찾기: 원문에서 같은 위치의 그라데이션
          const nth = (before.match(/gradient\(/g) || []).length;
          let count = 0;
          let lineNo = line;
          lines.forEach((l, i) => {
            const hits = (l.match(/gradient\(/g) || []).length;
            if (count <= nth && nth < count + hits) lineNo = i + 1;
            count += hits;
          });
          if (!lines[lineNo - 1]?.includes("/*ui-ok*/")) problems.push(`${rel}:${lineNo}  ${rule.msg}`);
        }
        continue;
      }
      lines.forEach((l, i) => {
        if (rule.re.test(l) && !l.includes("/*ui-ok*/")) problems.push(`${rel}:${i + 1}  ${rule.msg}\n    ${l.trim()}`);
      });
    }
  }
}

if (problems.length) {
  console.error(`화면 규칙 검사: ${problems.length}건\n` + problems.join("\n"));
  process.exit(1);
}
console.log("화면 규칙 검사: 문제 없음");
