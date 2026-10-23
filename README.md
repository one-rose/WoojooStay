# 우주스테이 홈페이지

숙박업 운영 플랫폼 **우주스테이(WOOJOO STAY)** 소개 페이지입니다.
Next.js 16 (App Router) · React 19 · TypeScript · pnpm — 한국어 · English · 日本語 · 中文

| 주소                  | 언어                   |
| --------------------- | ---------------------- |
| `/`                   | 한국어 (기본)          |
| `/en` · `/ja` · `/zh` | 영어 · 일본어 · 중국어 |

## 시작하기

```bash
nvm use            # Node 22 (.nvmrc)
corepack enable    # pnpm 10 활성화
pnpm install
pnpm dev           # http://localhost:3000
```

## 명령어

| 명령                        | 설명                                                                    |
| --------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                  | 개발 서버                                                               |
| `pnpm build` / `pnpm start` | 프로덕션 빌드 / 실행 (4개 언어 페이지 모두 정적 생성)                   |
| `pnpm check`                | 타입 검사 + ESLint(레이어 규칙 포함) + Prettier — **PR 올리기 전 필수** |
| `pnpm format`               | 코드 정렬                                                               |

## 자주 하는 작업

| 하고 싶은 일                   | 고칠 곳                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| 문구·숫자 수정                 | `src/infrastructure/home/content/ko.ts` (영어 `en.ts`, 일본어 `ja.ts`, 중국어 `zh.ts`)              |
| 새 문구 항목 추가              | `src/core/home/home-content.ts` 타입 → 4개 언어 파일 → 컴포넌트 순서 (타입 오류가 빠진 곳을 알려줌) |
| 색 변경                        | `src/ui/styles/tokens.css` (컬러 시안 C 고정)                                                       |
| 섹션 레이아웃 수정             | `src/ui/sections/<섹션>/` 의 `.tsx` + `.css`                                                        |
| 공통 부품(버튼·필·KPI 카드 등) | `src/ui/components/`                                                                                |
| 이미지 교체                    | `src/assets/` 에 같은 이름으로 덮어쓰기                                                             |
| 로고 교체                      | `src/ui/brand/logo-paths.ts`                                                                        |
| 링크 공유 미리보기 이미지      | `public/og/<언어>.jpg` (1200×630) 같은 이름으로 덮어쓰기                                            |

구조와 규칙은 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** 를 먼저 읽어주세요.

## 배포

Vercel 에 연결되어 있습니다. 프레임워크는 `vercel.json` 에 Next.js 로 고정되어 있습니다.
`main` 에 push 하면 자동 배포됩니다. 도메인을 바꾸면 Vercel 환경 변수 `NEXT_PUBLIC_SITE_URL` 을 새 주소로 지정하세요 (공유 이미지 주소의 기준).
