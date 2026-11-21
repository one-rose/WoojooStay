# 화면 규칙 10가지

2026-11-21 사용자 지정. 새 화면을 만들거나 고칠 때 항상 지킨다.
대상: 웹 관리화면(`src/ui/pms` — `/app`, `/app/me`, `/admin`), 네이티브 앱(`uzuStay-app` Android · iOS).
**랜딩(메인 홈페이지)은 대상이 아니다 — 건드리지 않는다.**

웹은 `pnpm check` 안의 `pnpm lint:ui`(`scripts/lint-ui-rules.mjs`)가 3 · 4 · 2 · 9를 자동으로 검사한다.
정당한 예외는 CSS 줄에 `/* ui-ok: 이유 */`.

| #   | 규칙                                                                     | 웹 (CSS)                                                                                                                                                              | Android (Compose)                                                                    | iOS (SwiftUI)                                                   |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 1   | 카드 안 둥근 칸: **안쪽 둥글기 = 바깥 둥글기 − 여백** (최소 4px)         | 패널이 `--pm-pad` 와 `--pm-r-md: max(4px, calc(var(--pm-r-lg) - var(--pm-pad)))` 를 정한다 → 안의 상자·입력칸이 자동으로 맞춰짐. 새 패널은 `.pm-nest` 또는 같은 두 줄 | `Panel`·시트가 `LocalNestedShape` 제공 → 상자·입력칸·띠는 `UzuShapes.box`            | `Panel`·시트가 `\.boxRadius` 환경값 → `Banner`·`UzuField` 가 씀 |
| 2   | 테두리는 **반투명** `rgb(0 0 0 / 0.12)` — 회색 단색 금지                 | `--pm-line` (0.12) · `--pm-line-soft` (0.07) · `--pm-line-strong` (0.2)                                                                                               | `line = Black 12%`, 어두운 화면은 `White 12%`                                        | 같음                                                            |
| 3   | 색은 **oklch()** — 여러 색의 눈에 보이는 밝기(L)를 맞춘다                | 모든 색 oklch. 상태 글자 L 50% · 상태 바탕 L 95.5%                                                                                                                    | `oklch(l, c, h)` 헬퍼 (`ui/theme/Oklch.kt`), 같은 숫자                               | `Color(oklch:)` · `Color(light:dark:)`, 같은 숫자               |
| 4   | 그라데이션은 **`linear-gradient(in oklch, …)`** — 가운데가 칙칙하지 않게 | 모든 그라데이션에 `in oklch`                                                                                                                                          | `oklchGradient()` — oklch 로 8단계 섞어 이어 붙임                                    | `Oklch.steps()` 로 같은 방식                                    |
| 5   | 아이콘 **선 굵기 = 옆 글자 굵기**                                        | `.pm-icon` 이 `--pm-stem`(글자 크기 × 0.075, 굵은 글자 0.1)을 `non-scaling-stroke` 로 그림. 버튼 · 지금 메뉴 · `b` · `strong` 은 굵게                                 | `UzuIcon(textSize, weight)` — 획 = 글자 크기 × 비율, 아이콘 크기와 무관              | 아이콘 생기면 `.fontWeight` 로 옆 글자와 같게                   |
| 6   | 옆으로 넘기는 줄은 **양 끝을 mask-image 로 서서히 흐리게**               | `.pm-hscroll` — 스크롤 위치에 따라 끝에 닿은 쪽은 선명 (scroll-timeline, 미지원 시 오른쪽만)                                                                          | 가로 줄 생기면 같은 방식 (`graphicsLayer` + 그라데이션 마스크)                       | 같음 (`.mask`)                                                  |
| 7   | 아이콘이 바뀔 때 **blur(4px) → 선명**                                    | `<Icon swap>` · `<PmButton iconSwap>` — 처음 그릴 때도 짧게 흐려짐                                                                                                    | `UzuIcon` 이 아이콘이 바뀔 때만 흐림 (처음은 바로)                                   | 아이콘 생기면 같은 방식                                         |
| 8   | 다크 모드는 **그림자 말고, 위에 올라온 면일수록 밝게**                   | (다크 모드 아직 없음)                                                                                                                                                 | `UzuColors.Dark` — 바탕 L 18% < 패널 22% < 시트(`surfaceRaised`) 26%. 아직 켜지 않음 | 같은 값, 앱 뿌리에서 `.preferredColorScheme(.light)` 로 꺼 둠   |
| 9   | 화면 높이는 **100dvh** (아이폰 사파리 아래 잘림 방지)                    | `100vh` 금지 (검사함)                                                                                                                                                 | 해당 없음                                                                            | 해당 없음                                                       |
| 10  | 흰 배경 사진은 밝은 바탕 위에서 **mix-blend-mode: multiply**             | 영수증 미리보기 `.ex-drop__preview`                                                                                                                                   | 사진 생기면 `BlendMode.Multiply`                                                     | `.blendMode(.multiply)`                                         |

## 예외

- 출근 QR 인쇄(`ClockQrPrint`)의 흰 바탕·검은 칸은 인식률 때문에 순수 흑백 그대로 둔다.
- 랜딩(`src/ui/home` 등)과 그 토큰 `src/ui/styles/tokens.css` 는 이 규칙을 적용하지 않는다.
