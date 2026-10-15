# 아키텍처

5명 내외 팀이 **서로 안 부딪히고**, **어디를 고쳐야 하는지 바로 알 수 있게** 하는 것이 목표입니다.
클린 아키텍처의 핵심(의존성은 안쪽으로만)을 프론트엔드 크기에 맞게 가볍게 적용했습니다.

## 레이어

```
src/
├─ core/             ① 도메인 — 타입, 유스케이스, 저장소 인터페이스 (React·Next 모름)
├─ infrastructure/   ② 구현 — 실제 데이터(현재 정적 TS, 추후 CMS/API), 컬러 시안 값
├─ ui/               ③ 화면 — 컴포넌트·섹션·스타일 (데이터 출처 모름, props 로만 받음)
├─ shared/           공용 순수 유틸 (cx, 숫자 포맷 등) — 어떤 레이어에도 의존 안 함
├─ config/           환경 변수 해석
├─ assets/           이미지 (일러스트, 플랫폼 로고)
└─ app/              ④ 조립 지점 — Next.js 라우트. infrastructure 를 core 에 꽂아 ui 에 넘김
```

의존 방향 (화살표 = import 가능):

```
app ──▶ ui ──▶ core ◀── infrastructure
 │              ▲
 ├──▶ config ───┘
 └──▶ infrastructure
모든 레이어 ──▶ shared
```

이 규칙은 **ESLint 로 강제**됩니다 (`eslint.config.mjs`). 어기면 `pnpm lint` 가 실패합니다.

| 레이어           | import 금지                                  |
| ---------------- | -------------------------------------------- |
| `core`           | react, next, infrastructure, ui, app, config |
| `infrastructure` | react, next, ui, app                         |
| `ui`             | infrastructure, app, config                  |
| `shared`         | 모든 다른 레이어                             |

### 왜 이렇게?

- **카피·숫자 수정이 화면 코드를 건드리지 않는다.** 기획/마케팅 수정은 `home-content.ko.ts` 한 파일에서 끝.
- **데이터 출처 교체가 쉽다.** 나중에 CMS·API 로 바꿀 때 `HomeContentRepository` 를 구현하는 클래스 하나만 새로 만들고
  `src/infrastructure/index.ts` 에서 바꿔 끼우면 됩니다. ui 는 변경 없음.
- **다국어 확장.** `home-content.en.ts` 를 추가하고 저장소 맵에 등록하면 끝.

## 데이터 흐름

```
app/page.tsx
  └─ getHomeContent(homeContentRepository)     core 유스케이스 + infrastructure 구현
       └─ <HomeView content={...} />            ui/views — 섹션 조립만
            ├─ <Hero content={content.hero} />  ui/sections — 각 섹션은 자기 몫의 데이터만 받음
            └─ ...
```

콘텐츠 타입은 `src/core/home/home-content.ts` 에 섹션별로 정의되어 있습니다.
**새 문구 필드가 필요하면 타입 → 데이터 → 컴포넌트 순서로** 추가하세요 (타입이 빠진 곳을 알려줍니다).

## ui 폴더 규칙

```
ui/
├─ styles/       전역 토큰(tokens.css) · 리셋(base.css) — 거의 안 건드림
├─ brand/        로고·브랜드 마크 SVG
├─ media/        일러스트·플랫폼 로고 (이미지 다루는 부품)
├─ components/   재사용 부품: Button, Pill, Section, Container, SectionIntro, KpiCard, PanelHeader, Lines, Glyphs
├─ scheme/       컬러 시안 스타일시트 생성 + 전환 버튼
├─ sections/     페이지 섹션 (Hero, AiReviewSection, LedgerSection ...)
└─ views/        섹션을 순서대로 조립한 페이지 화면
```

- **컴포넌트 1개 = 폴더 1개** (`Name/Name.tsx` + `Name/Name.module.css`). 섹션 전용 하위 부품은 그 섹션 폴더 안에 둡니다
  (예: `LedgerSection/TrendChart.tsx`). 두 섹션 이상에서 쓰이게 되면 `components/` 로 올립니다.
- 폴더마다 `index.ts` 로 공개할 것만 내보냅니다. 다른 폴더에서는 `index` 를 통해서만 import 하세요.
- 서버 컴포넌트가 기본입니다. `"use client"` 는 상호작용이 필요한 곳(현재 `SchemeSwitcher` 하나)만.
- 스타일은 CSS Modules. **색은 반드시 CSS 변수(`var(--ink)` 등)로** 씁니다 — 하드코딩하면 시안 전환이 안 됩니다.
- 부모가 자식 컴포넌트 스타일을 덮어쓸 땐 `.parent .child` 처럼 두 단계 선택자를 씁니다 (CSS Modules 로딩 순서 문제 방지).
- 반응형 기준: `1340px` · `1100px`(태블릿) · `720px`(모바일). 데스크톱 시안 폭 1440, 컨테이너 1288.

## 컬러 시안(테마)

- 시안 값: `src/infrastructure/brand/color-schemes.ts` — 시안마다 CSS 변수 목록(`tokens`)을 가짐.
- 서버에서 `[data-scheme="c"] { --ink: ...; --illust-chat: url(...) }` 형태의 스타일시트를 만들어 `<head>` 에 넣습니다
  (`ui/scheme/scheme-stylesheet.ts`). **일러스트도 CSS 변수로 바뀌기 때문에 전환 시 리렌더가 없습니다.**
- 저장된 시안은 `<head>` 인라인 스크립트가 첫 페인트 전에 복원 → 색 깜빡임 없음.
- 시안 확정 후에는 `NEXT_PUBLIC_DEFAULT_SCHEME=<확정 시안>`, `NEXT_PUBLIC_SCHEME_SWITCHER=off` 로 두면 됩니다.

## 팀 작업 규칙

1. 브랜치: `feat/<내용>`, `fix/<내용>` → PR → 1명 리뷰 후 merge.
2. PR 전 `pnpm check` 통과 필수 (타입 · 레이어 규칙 · 포맷).
3. 섹션 단위로 담당을 나누면 파일 충돌이 거의 없습니다 (섹션 = 폴더).
4. 카피 수정 PR 은 `home-content.ko.ts` 만 바뀌어야 정상입니다.
5. 자동 생성 파일(`illustration-manifest.ts`, `logo-paths.ts`)은 손으로 고치지 않습니다.
