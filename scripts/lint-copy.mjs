#!/usr/bin/env node
/**
 * 말과 숫자 검사 (docs/PMS-DESIGN-SYSTEM.md 7장) — 화면 코드(src/ui/pms, src/app)에서
 * "AI로 만든 티"와 단위 뒤섞임을 빠르게 찾는다. pnpm check 에서 돈다.
 *
 * 찾는 것
 * - 버튼·링크 글자 안의 가운뎃점 (<button>…·…</button>, <PmButton>…·…</PmButton>)
 * - 영문 시간 단위: {n}h, `${n}h`
 * - 백만 단위 "M": toFixed(…)}M, formatMillions
 * - 영문 대문자 꼬리표: BACK OFFICE
 * - 띄어쓴 조사: "</strong> 까지", "</strong> 이 " (숫자 강조 뒤 조사는 붙여 쓴다)
 *
 * 정당한 경우는 줄 끝에 `// copy-ok` 를 붙이거나 아래 ALLOW 에 파일을 넣는다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIRS = ["src/ui/pms", "src/app/(pms)", "src/app/(admin)"];
/** 이 파일들은 검사하지 않는다 (사유) */
const ALLOW = new Set([
  "src/ui/pms/components/Icon/Icon.tsx", // SVG 경로 글자 (h = 가로선 명령)
]);

const RULES = [
  { id: "hour-h", msg: "시간에 영문 h — formatHours() 로 '시간'", re: /(\}h\b|\}h<|\dh\b(?!\w)|`\$\{[^}]+\}h`)/ },
  { id: "million-m", msg: "백만 단위 M — formatWonCompact() 로 '만'", re: /(toFixed\(\d\)\}?M\b|formatMillions)/ },
  {
    id: "spaced-middot",
    msg: "띄어 쓴 가운뎃점으로 메타를 이음 — 한 가지만 쓰거나 쉼표·'›'로 (낱말 사이 붙인 가운뎃점은 괜찮음)",
    re: /\S · \S/,
  },
  { id: "english-tag", msg: "영문 대문자 꼬리표 — 한국어로", re: /BACK OFFICE/ },
  { id: "josa-space", msg: "강조한 숫자 뒤 조사를 띄어 씀 — 붙여 쓰기", re: /<\/strong> (까지|이 |가 |을 |를 |에 )/ },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mts)$/.test(name)) out.push(p);
  }
  return out;
}

const problems = [];
for (const d of DIRS) {
  let files = [];
  try {
    files = walk(join(ROOT, d));
  } catch {
    continue;
  }
  for (const f of files) {
    const rel = relative(ROOT, f);
    if (ALLOW.has(rel)) continue;
    const text = readFileSync(f, "utf8");
    const lines = text.split("\n");
    // 버튼·링크 글자 안의 가운뎃점 — 여러 줄에 걸친 JSX 도 (여는 태그 ~ 닫는 태그 사이의 글자만)
    for (const m of text.matchAll(/<(button|PmButton|Link)\b[^>]*>([^<]*)<\/\1>/g)) {
      // 메뉴 이름(요금·재고, 직원·권한, 구독·결제)은 고유 이름이라 그대로 둔다
      const label = m[2].replace(/요금·재고|직원·권한|구독·결제/g, "");
      if (!label.includes("·") || m[0].includes("copy-ok")) continue;
      const line = text.slice(0, m.index).split("\n").length;
      problems.push(
        `${rel}:${line}  [middot-in-button] 버튼·링크 글자에 가운뎃점 — 쉼표나 '과/와'로\n    ${m[2].trim().slice(0, 120)}`,
      );
    }
    lines.forEach((line, i) => {
      const t = line.trim();
      if (
        t.startsWith("//") ||
        t.startsWith("*") ||
        t.startsWith("/*") ||
        t.startsWith("{/*") ||
        line.includes("copy-ok")
      )
        return;
      for (const r of RULES)
        if (r.re.test(line)) problems.push(`${rel}:${i + 1}  [${r.id}] ${r.msg}\n    ${t.slice(0, 120)}`);
    });
  }
}

if (problems.length) {
  console.error(`말과 숫자 검사: ${problems.length}곳\n\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("말과 숫자 검사: 문제 없음");
