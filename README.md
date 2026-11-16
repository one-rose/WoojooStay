# 우주스테이 홈페이지

숙박업 운영 플랫폼 **우주스테이(WOOJOO STAY)** 소개 페이지입니다.
Next.js 16 (App Router) · React 19 · TypeScript · pnpm — 한국어 · English · 日本語 · 中文

| 주소                  | 언어                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/`                   | 한국어 (기본)                                                                                                    |
| `/en` · `/ja` · `/zh` | 영어 · 일본어 · 중국어                                                                                           |
| `/app`                | 우주스테이 앱(PMS) — API 주소가 없으면 예시 데이터, 검색 노출 안 함 · [디자인 시스템](docs/PMS-DESIGN-SYSTEM.md) |
| `/admin`              | 운영팀 백오피스 — 운영자 계정(이메일)으로만 로그인                                                               |

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

## 백엔드 (api/)

`api/` 폴더는 NestJS + PostgreSQL API 서버입니다 (홈페이지 빌드·배포와 별개). 실행 방법은 **[api/README.md](api/README.md)**.

앱 화면(`/app`)을 실서버와 연결하려면 루트에서 `PMS_API_URL` 을 지정해 실행합니다.

```bash
PMS_API_URL=http://localhost:4000 pnpm dev
```

`PMS_API_URL` 이 없으면 앱 화면은 예시 데이터로만 동작합니다. 연결된 화면: 로그인·가입, 온보딩, 홈, AI 리뷰·말투 설정, 매출장부, 알바관리(근로계약서 서명 포함), 지출관리, 설정(업장·직원 계정·알림·구독), 알림, 운영자 백오피스(`/admin`), 직원 출퇴근(`/app/me`), 랜딩 도입 문의 창. 요금·재고 화면만 아직 예시 데이터입니다.

### 체험 모드 (서버 없이 배포)

`PMS_API_URL` 을 넣지 않고 배포하면(지금 Vercel) **체험 모드**로 열립니다.

- 화면 맨 위에 "체험 모드" 띠와 사장님·직원·운영자 화면 바로가기가 보입니다. 로그인은 아무 번호로나 됩니다.
- 예시 데이터(`src/infrastructure/pms/sample-data.ts`, `business-data.ts`)는 2026-11-10 을 기준으로 만들어져 있고, 열 때마다 **오늘 날짜에 맞춰 옮겨서** 보여 줍니다 (`demo-clock.ts`).
- 버튼을 눌러도 저장되지 않고 "체험 모드라 저장되지 않아요" 안내가 나옵니다.
- 서버를 붙일 때는 배포 환경 변수에 `PMS_API_URL` 만 넣으면 실서버 모드로 바뀝니다.

## 배포

Vercel 에 연결되어 있습니다. 프레임워크는 `vercel.json` 에 Next.js 로 고정되어 있습니다.
`main` 에 push 하면 자동 배포됩니다. 도메인을 바꾸면 Vercel 환경 변수 `NEXT_PUBLIC_SITE_URL` 을 새 주소로 지정하세요 (공유 이미지 주소의 기준).
