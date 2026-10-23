# 아키텍처

5명 내외 팀이 **서로 안 부딪히고**, **어디를 고쳐야 하는지 바로 알 수 있게** 하는 것이 목표입니다.
클린 아키텍처의 핵심(의존성은 안쪽으로만)을 프론트엔드 크기에 맞게 가볍게 적용했습니다.

## 레이어

```
src/
├─ core/             ① 도메인 — 콘텐츠 타입, 언어 목록, 유스케이스, 저장소 인터페이스 (React·Next 모름)
├─ infrastructure/   ② 구현 — 언어별 콘텐츠 데이터(현재 정적 TS, 추후 CMS/API)
├─ ui/               ③ 화면 — 컴포넌트·섹션·스타일 (데이터 출처 모름, props 로만 받음)
├─ shared/           공용 순수 유틸 (cx, 숫자 포맷, 곡선 path) — 어떤 레이어에도 의존 안 함
├─ assets/           이미지 (일러스트, 플랫폼 로고, 리뷰 사진, 국기)
└─ app/              ④ 조립 지점 — Next.js 라우트. infrastructure 를 core 에 꽂아 ui 에 넘김
```

의존 방향 (화살표 = import 가능):

```
app ──▶ ui ──▶ core ◀── infrastructure
 └──────────────────────▶ infrastructure
모든 레이어 ──▶ shared
```

이 규칙은 **ESLint 로 강제**됩니다 (`eslint.config.mjs`). 어기면 `pnpm lint` 가 실패합니다.

| 레이어           | import 금지                          |
| ---------------- | ------------------------------------ |
| `core`           | react, next, infrastructure, ui, app |
| `infrastructure` | react, next, ui, app                 |
| `ui`             | infrastructure, app                  |
| `shared`         | 모든 다른 레이어                     |

### 왜 이렇게?

- **문구·숫자 수정이 화면 코드를 건드리지 않는다.** 언어별 파일 하나(`infrastructure/home/content/<언어>.ts`)에서 끝.
- **언어를 빠뜨릴 수 없다.** 4개 언어 파일이 모두 같은 `HomeContent` 타입이라, 한 언어에만 항목을 추가하면 타입 오류가 난다.
- **데이터 출처 교체가 쉽다.** CMS·API 로 바꿀 때 `HomeContentRepository` 를 구현하는 클래스 하나만 새로 만들고
  `src/infrastructure/index.ts` 에서 바꿔 끼우면 됩니다. ui 는 변경 없음.

## 라우팅 · 다국어

```
src/app/[locale]/layout.tsx   <html lang>, 메타데이터, 전역 CSS
src/app/[locale]/page.tsx     콘텐츠 조회 → <HomeView>
next.config.ts                "/" → "/ko" (rewrite),  "/ko" → "/" (redirect)
```

- 언어 목록은 `src/core/i18n/locale.ts` 의 `LOCALES` 한 곳에만 있습니다. 4개 페이지 모두 빌드 때 정적 HTML 로 만들어집니다.
- 언어 버튼은 각 언어 주소로 가는 링크입니다 (검색엔진도 언어별 페이지를 따로 수집).
- 그림 속에 한글이 들어간 일러스트는 외국어 페이지에서 `-notext` 버전을 씁니다 (콘텐츠 파일에서 지정).
- 언어별 글꼴·줄바꿈 규칙은 `src/ui/styles/global.css` 의 `html[lang="…"]` 부분.

## 데이터 흐름

```
app/[locale]/page.tsx
  └─ getHomeContent(homeContentRepository, locale)   core 유스케이스 + infrastructure 구현
       └─ <HomeView content locale />                ui/views — 섹션 조립만
            ├─ <Hero content={content.hero} />       ui/sections — 각 섹션은 자기 몫의 데이터만 받음
            └─ ...
```

## ui 폴더 규칙

```
ui/
├─ styles/       tokens.css(색·폰트 토큰) · global.css(리셋·태그·언어별) · base.css(container 등)
├─ brand/        로고·브랜드 마크 SVG
├─ media/        이미지 부품 (Illustration, PlatformLogo, ReviewPhoto)
├─ components/   재사용 부품: Button, Pill, Section, SectionHead, KpiCard, PanelTop, Lines, Glyphs
├─ sections/     페이지 섹션 13개 (SiteHeader, Hero, … , SiteFooter)
└─ views/        섹션을 순서대로 조립한 페이지 화면
```

- **컴포넌트 1개 = 폴더 1개** (`Name/Name.tsx` + `Name/<name>.css`). 섹션 전용 하위 부품은 그 섹션 폴더 안에 둡니다
  (예: `Hero/HeroDashboard.tsx`). 두 섹션 이상에서 쓰이게 되면 `components/` 로 올립니다.
- 폴더마다 `index.ts` 로 공개할 것만 내보냅니다. 다른 폴더에서는 `index` 를 통해서만 import 하세요.
- 서버 컴포넌트가 기본입니다. `"use client"` 는 상호작용이 필요한 곳만: 숫자 카운트(`TrustStats/CountUp`),
  숙박 유형 탭(`UseCasesSection/UseCaseTabs`).

### 스타일 (BEM)

퍼블리싱 결과물의 클래스 이름을 그대로 쓰는 **BEM 전역 CSS** 입니다. 퍼블리셔와 같은 이름으로 소통할 수 있게 하려는 선택입니다.

- 블록(`.hero`, `.rv-list` …) 하나는 **딱 한 파일**에만 정의합니다. 파일은 그 블록을 그리는 컴포넌트 폴더에 두고,
  컴포넌트 `.tsx` 맨 위에서 `import "./hero.css"` 합니다.
- 다른 블록을 상황에 따라 덮어쓸 때는 `.hero__cta .btn` 처럼 **부모 블록 파일**에 씁니다.
- 새 블록 이름은 다른 파일과 겹치지 않게 지으세요 (전역이므로). 블록 → 파일 대응은 아래 표 참고.
- 색은 반드시 `var(--토큰)` 으로. 반응형 기준: `1340px` · `1100px` · `720px` · `420px` · `360px`.

| 파일                                                         | 블록                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `styles/base.css`                                            | container, block-narrow, illust, won, arrow                                           |
| `brand/brand.css`                                            | logo, orb, duo                                                                        |
| `components/*`                                               | btn, pill, section · sec-head · sec-title · sec-desc, kpi · kpi-row, panel-top · tabs |
| `sections/SiteHeader`                                        | header, lang                                                                          |
| `sections/Hero`                                              | hero, orbit-slot, orbit / hero-dash, bars, ai-card, float-card                        |
| `sections/PlatformStrip` · `TrustStats`                      | platforms · trust                                                                     |
| `sections/AiReviewSection`                                   | s1, features, rv-panel, rv-list, rv-cta                                               |
| `sections/LedgerSection`                                     | ledger, trend, settle, adeff, bridge                                                  |
| `sections/FinanceSection`                                    | fin-grid, fin-card, flow, orbit-band                                                  |
| `sections/OperationsSection`                                 | ops-grid, ops-card, ops-panel, staff, expense                                         |
| `sections/UseCasesSection` · `RoadmapSection`                | cases · roadmap, steps, step, growth                                                  |
| `sections/EasyStartSection` · `ValuesSection` · `SiteFooter` | easy · closing, values, final-band · footer                                           |

## 팀 작업 규칙

1. 브랜치: `feat/<내용>`, `fix/<내용>` → PR → 1명 리뷰 후 merge.
2. PR 전 `pnpm check` 통과 필수 (타입 · 레이어 규칙 · 포맷).
3. 섹션 단위로 담당을 나누면 파일 충돌이 거의 없습니다 (섹션 = 폴더).
4. 문구 수정 PR 은 `infrastructure/home/content/*.ts` 만 바뀌어야 정상입니다. 한 언어를 고치면 나머지 언어도 함께 확인하세요.
5. `logo-paths.ts` 는 손으로 고치지 않습니다 (디자이너 SVG 로 통째 교체).
