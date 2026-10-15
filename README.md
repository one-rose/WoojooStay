# 우주스테이 홈페이지

숙박업 운영 플랫폼 **우주스테이(WOOJOO STAY)** 소개 페이지입니다.
Next.js 16 (App Router) · React 19 · TypeScript · CSS Modules · pnpm

## 시작하기

```bash
nvm use            # Node 22 (.nvmrc)
corepack enable    # pnpm 10 활성화
pnpm install
cp .env.example .env.local
pnpm dev           # http://localhost:3000
```

## 명령어

| 명령                        | 설명                                                                    |
| --------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                  | 개발 서버                                                               |
| `pnpm build` / `pnpm start` | 프로덕션 빌드 / 실행 (페이지는 정적으로 생성됨)                         |
| `pnpm check`                | 타입 검사 + ESLint(레이어 규칙 포함) + Prettier — **PR 올리기 전 필수** |
| `pnpm format`               | 코드 정렬                                                               |
| `pnpm gen:illustrations`    | 일러스트 추가·교체 후 목록 파일 재생성                                  |

## 환경 변수

| 이름                          | 값                                          | 설명                                           |
| ----------------------------- | ------------------------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_DEFAULT_SCHEME`  | `purple` \| `a` \| `b` \| `c` \| `d` \| `e` | 처음 보여줄 컬러 시안 (기본 `purple`)          |
| `NEXT_PUBLIC_SCHEME_SWITCHER` | `on` \| `off`                               | 오른쪽 아래 시안 전환 버튼. 시안 확정 후 `off` |

## 자주 하는 작업

| 하고 싶은 일                   | 고칠 곳                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 문구·숫자 수정                 | `src/infrastructure/home/home-content.ko.ts` (이 파일 하나에 모든 카피가 있음)                          |
| 컬러 시안 색 수정 / 시안 추가  | `src/infrastructure/brand/color-schemes.ts` (+ 추가 시 `src/core/brand/color-scheme.ts`의 `SCHEME_IDS`) |
| 섹션 레이아웃 수정             | `src/ui/sections/<섹션>/` 의 `.tsx` + `.module.css`                                                     |
| 공통 부품(버튼·필·KPI 카드 등) | `src/ui/components/`                                                                                    |
| 일러스트 교체                  | `src/assets/illustrations/<시안>/` 에 같은 이름으로 덮어쓰기                                            |
| 로고 교체                      | `src/ui/brand/logo-paths.ts`                                                                            |

구조와 규칙은 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** 를 먼저 읽어주세요.

## 배포

Vercel 에 연결되어 있습니다. (Project Settings → Framework Preset: **Next.js**)
`main` 에 push 하면 자동 배포됩니다.
