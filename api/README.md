# 우주스테이 API

NestJS 12 · Prisma 7 · PostgreSQL 16 · TypeScript (ESM) · Vitest
화면(Next.js, 저장소 루트)과 같은 저장소의 `api/` 폴더에 있는 독립 프로젝트입니다.

**MVP 범위** (기능정의서 26-11-08 기준) · DB 이름 규칙은 [docs/DB-NAMING.md](docs/DB-NAMING.md) (`wj_` 접두사)

| 영역 | 기능 ID | 경로 (`/api/v1`) |
| --- | --- | --- |
| 가입·로그인·약관 | F0-01, F0-17 | `/auth/phone/send-code` · `/auth/phone/verify` · `/auth/signup` · `/auth/login` · `/auth/refresh` · `/auth/logout` · `/auth/password/reset` · `/auth/me` |
| 업장 | F0-02 | `/biz-no/check` · `/properties` · `/properties/:id` |
| 직원 계정·권한 | F0-03 | `/properties/:id/members` · `/properties/:id/invitations` · `/invitations/:token`(미리보기, 로그인 없이) · `/invitations/accept` |
| 채널 연동·수집 | F0-04 ~ F0-07 | `/properties/:id/channels` · `/:channel/connect` · `/:channel/sync` |
| AI 리뷰 | F1-01 ~ F1-04, F1-07, F1-08 | `/properties/:id/reviews` · `/reviews/:rid/draft` · `/reviews/:rid/reply` · `/properties/:id/reply-settings` |
| 홈 대시보드 | F0-12 | `/properties/:id/dashboard` |
| 알림 | F0-13 | `/notifications` · `/notifications/read-all` · `/notifications/:id/read` · `/properties/:id/notification-settings` |
| 구독·결제 | F0-08, F0-09 | `/plans` · `/properties/:id/billing` · `/properties/:id/subscriptions/:plan` · `/properties/:id/payment-method` |
| 매출장부 | F2-01 ~ F2-06 | `/properties/:id/ledger?month=` · `/properties/:id/ledger/ad-spend` |
| 알바관리 | F5-01 ~ F5-04, F5-06 | `/properties/:id/staff` · `/staff/employees` · `/staff/employees/:eid/contract` · `/staff/me`(직원 본인) · `/staff/attendance/clock` · `/staff/attendance` · `/staff/shifts` · `/staff/payroll/:month/{calculate,confirm,reopen,send}` · `/contracts/:token` · `/contracts/:token/sign` |
| 지출관리 | F6-01, F6-03, F6-04 | `/properties/:id/expenses` · `/receipts` · `/receipts/:rid/register` · `/orders` · `/orders/:oid` |
| 현장 업무 (객실 상태·인수인계·공지) | F7-01 ~ F7-03 ※ 사업소개서 '내부 업무시스템' — 기능정의서에 추가 필요 | `/properties/:id/ops` · `/rooms` · `/rooms/:rid` · `/rooms/:rid/status` · `/rooms/:rid/logs` · `/ops-notes` · `/ops-notes/:nid/{read,pin}` |
| 여러 업장 통합 현황 | F8 | `/portfolio` — 내가 사장님·매니저인 업장 전부의 오늘·이번 달 매출 · 미답변 · 7일 정산 · 객실 · 근무 · 연동 + 확인할 일(급한 순). 직원으로만 속한 업장은 빠짐 |
| 운영자 | F0-14, F0-16 | `/admin/auth/login` · `/admin/overview` · `/admin/properties` · `/admin/sync-issues` · `/admin/inquiries` · `/admin/admins` · `/inquiries`(랜딩 문의, 로그인 없음) |

API 문서(Swagger): 서버 실행 후 http://localhost:4000/api/docs

## 시작하기

```bash
cd api
cp .env.example .env          # 값 채우기 (아래 표)
docker compose up -d          # 로컬 PostgreSQL (또는 직접 설치한 DB)
corepack enable && pnpm install   # 설치하면서 Prisma 클라이언트도 만들어짐
pnpm db:migrate               # 테이블 만들기
pnpm build && pnpm db:seed    # 예시 데이터 (아래 계정)
pnpm start:dev                # http://localhost:4000
```

예시 데이터(`db:seed`): 업장 1곳 · 9개 채널 300일치 매출·정산 · 직원 5명 · 지출·발주 · 30일 무료 체험 · 도입 문의 3건

| 계정 | 로그인 | 주소 |
| --- | --- | --- |
| 사장님 | 010-0000-0000 / `woojoo1234` | http://localhost:3000/app/login |
| 여러 업장 대표 (한소영, 10곳) | 010-2000-0000 / `woojoo1234` | 같은 로그인 → 전체 현황 `/app/overview` |
| 직원 (김민지) | 010-1111-2222 / `woojoo1234` | 같은 로그인 → 출퇴근 화면 `/app/me` |
| 운영자 (최고 관리자) | admin@woojoo.kr / `Woojoo1234!` | http://localhost:3000/admin/login |

운영 서버에서는 시드 대신 `pnpm admin:create -- --email <이메일> --name <이름> [--super]` 로 운영자를 만듭니다 (비밀번호는 화면에 안 보이게 입력, 10자 이상·영문·숫자·특수문자).

화면과 연결하려면 저장소 루트에서 `PMS_API_URL=http://localhost:4000 pnpm dev` 로 실행합니다.
`PMS_API_URL` 이 없으면 화면은 지금처럼 예시 데이터로만 동작합니다 (Vercel 배포 영향 없음).

| 환경 변수 | 설명 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 주소 |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | 토큰 서명 키 (32자 이상) |
| `CREDENTIALS_KEY` | 채널 계정 정보 암호화 키 — `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | AI 답글. 비워 두면 규칙 기반 템플릿 답글 (한국어만) |
| `AI_MODEL` | 기본 `claude-haiku-5-5` |
| `SYNC_ENABLED` | `true` 면 30분마다 채널 자동 수집 + 매일 9시 정기결제 |
| `UPLOAD_DIR` | 영수증 사진 저장 폴더 (기본 `./uploads`, 운영은 도커 볼륨) |
| `NTS_SERVICE_KEY` | 국세청 사업자 상태조회 (공공데이터포털). 비우면 검증번호만 확인 |
| `ALIGO_API_KEY` · `ALIGO_USER_ID` · `SMS_SENDER` | 알리고 문자. 셋 다 있어야 실제 발송, 비우면 로그만 |
| `TOSS_SECRET_KEY` | 토스페이먼츠 자동결제. 비우면 개발용 가짜 PG (화면 쪽은 `TOSS_CLIENT_KEY`) |
| `SMS_ALERTS_ENABLED` | `true` 면 급한 알림(저평점 리뷰·채널 연동 끊김)을 사장님·매니저에게 문자로도. 알림 설정에서 '문자·알림톡' 을 끈 사람은 빼요 |
| `WEB_ORIGIN` | 화면 주소 (CORS, 쉼표로 여러 개). 문자로 보내는 초대·근로계약서 링크는 **첫 번째 주소**로 만든다 (`https://…/app/invite?token=` · `/app/contract/:token`) |
| `INTERNAL_API_KEY` | (선택, 32자 이상) 화면 서버 ↔ API 내부 키 — 아래 '화면 서버 ↔ API 헤더 약속'. 운영에서는 꼭 넣는다 |
| `TRIAL_DAYS` | 새 업장 무료 체험 일수 (기본 30, 파일럿은 56) |
| `ALLOW_FAKE_INTEGRATIONS` | 기본 `false`. 운영(`NODE_ENV=production`)에서 `TOSS_SECRET_KEY` 나 알리고 세 값이 없으면 **시작하지 않는다**. 문자·결제 없이 일부러 띄울 때만 `true` (시작 로그에 가짜 연동 목록이 경고로 나온다) |

### 화면 서버 ↔ API 헤더 약속 (요청 제한)

운영에서는 화면 서버(Next.js)만 API 를 부르므로, API 가 보는 IP 는 모두 화면 서버 하나다.
그래서 사용자별 요청 제한(분당 600회, 인증번호·로그인은 더 낮게)은 화면 서버가 알려준 사용자 IP 로 센다.

| 헤더 | 값 |
| --- | --- |
| `x-internal-key` | `INTERNAL_API_KEY` 와 같은 값 |
| `x-client-ip` | 화면 서버가 받은 사용자 IP (프록시 뒤라면 신뢰할 수 있는 첫 IP) |

- 두 헤더가 모두 있고 키가 맞을 때만 `x-client-ip` 를 믿는다. 아니면 연결한 쪽 IP(`req.ip`)로 센다 — 키 없이 보낸 `x-client-ip` 는 무시.
- `trust proxy` 는 켜지 않는다 (`X-Forwarded-For` 는 보지 않음).
- 한도를 넘으면 429. 인증번호 발송은 따로 번호·목적별 **1분에 1번, 하루(한국 날짜) 10번** (`SMS_COOLDOWN` · `SMS_DAILY_LIMIT`, 429).

## 명령어

| 명령 | 설명 |
| --- | --- |
| `pnpm start:dev` | 개발 서버 (저장하면 다시 시작) |
| `pnpm build` / `pnpm start:prod` | 빌드 / 실행 |
| `pnpm test` | 단위 테스트 |
| `pnpm test:e2e` | 실제 DB로 전체 흐름 테스트 — `TEST_DATABASE_URL`(이름이 `_test` 로 끝나는 DB) 필요 |
| `pnpm check` | 타입 · 린트(oxlint) · 포맷 검사 |
| `pnpm db:migrate:dev --name <이름>` | 스키마(`prisma/schema.prisma`) 바꾼 뒤 마이그레이션 만들기 |
| `pnpm admin:create -- --email … --name … [--super]` | 운영자 계정 만들기 (빌드 후) |

## 구조

```
src/
├─ auth/            가입·로그인·토큰 (휴대폰 인증 3분, 5회 실패 시 재발송, 리프레시 토큰 1회용)
├─ properties/      업장 · 직원 초대/권한 · 사업자번호 확인(BizVerifier)
├─ connectors/      채널 연결 방식(ChannelConnector) · 채널 목록 · 계정 정보 암호화(AES-256-GCM)
├─ channels/        연결·수집 · 30분 정기 수집
├─ reviews/         리뷰 목록·탭 · AI 초안 · 게시 · 말투 설정 · 수집 시 자동 응대
├─ ai/              답글 생성(ReplyGenerator): Claude API / 템플릿
├─ dashboard/       홈 요약
├─ ledger/          매출장부 — 월 매출·수수료·광고비·10개월 추이·정산 달력·가격 비교·대실/숙박
├─ staff/           알바관리 — 직원·근로계약서 서명·출퇴근·근무표·급여(payroll.ts 계산 규칙)
├─ expenses/        지출·영수증 인식(ReceiptReader)·발주(입고하면 지출 자동 등록)
├─ ops/             현장 업무 — 객실 상태판·변경 이력 · 교대 인수인계 · 공지 · 확인 표시
├─ billing/         구독·정기결제(PaymentGateway)·알림 받기 설정
├─ admin/           운영자 로그인(이메일, 8시간 토큰)·업장 현황·수집 오류·도입 문의
├─ notifications/   앱 안 알림
├─ sms/             문자 발송(SmsSender) — 알리고 키가 있으면 실제 발송, 없으면 로그만
├─ common/          권한 가드 · 오류 코드 · 유틸
└─ prisma/          DB 연결
```

### 외부 연동 — 키를 넣으면 실제, 비우면 가짜

| 무엇 | 키 있음 | 키 없음 (개발·테스트) |
| --- | --- | --- |
| 문자 발송 | `AligoSmsSender` | `ConsoleSmsSender` — 로그만 |
| 사업자 상태 확인 | `NtsBizVerifier` (국세청 서버 장애 시 검증번호로 대신) | `ChecksumBizVerifier` — 검증번호만 |
| 정기결제 PG | `TossPaymentGateway` — 화면은 토스 카드 등록 창 → `/app/billing/card` 로 돌아옴 | `FakePaymentGateway` |
| AI 답글 · 영수증 인식 | Claude API | 템플릿 답글 · 날짜만 채움 |

실제 서버로 확인은 각 업체 **테스트 키**로 해야 합니다 (`src/common/external-adapters.spec.ts` 는 요청 모양만 확인).

### 아직 가짜로 동작하는 부분 (교체 지점)

실제 업체·채널이 정해지면 아래 클래스만 새로 구현해 모듈에서 바꿔 끼우면 됩니다. 나머지 코드는 그대로입니다.

| 무엇 | 지금 | 바꿀 곳 |
| --- | --- | --- |
| 채널 연동 (리뷰·매출·정산 수집, 답글 게시) | `SampleChannelConnector` — 정해진 예시 데이터. 비밀번호 `wrong` 이면 로그인 실패 | `connectors/` 에 채널별 `ChannelConnector` 구현 |
| 채널별 답글 방식 | `connectors/catalog.ts` 의 `replyMode` — 공식 답글 API 가 확인된 호텔스닷컴(Expedia)만 `API`, 나머지는 `COPY`(사장님이 복사해서 게시, 자동 응대 안 함) | 다른 채널도 공식 API 가 확인되면 `API` 로 |
| 주변 경쟁 업소 가격 | `SampleCompetitorSource` — 예시 3곳 | `connectors/competitor-source.ts` |
| 영수증 사진 저장 | 로컬 폴더(`UPLOAD_DIR`) — 운영은 도커 볼륨 + 매일 백업 | 업장이 많아지면 S3 등 |

개발 환경(`NODE_ENV` 가 production 이 아닐 때)에서는 인증번호·초대 토큰을 응답에 `devCode` · `devToken` 으로 함께 돌려줍니다. 운영에서는 나가지 않습니다 (설정값이나 실제 프로세스 중 하나라도 production 이면 안 나감).

### 급여 계산 규칙 (`staff/payroll.ts`) — 노무사 확인 전 기준

- **시급제**: 근무시간 × 시급 + 야간(22~06시) 50% 가산 + 주휴수당.
- **주휴수당**: 한 주(월~일) 근무 15시간 이상일 때 `min(8, 주 근무시간 ÷ 40 × 8)` 시간분. 그 주는 **일요일이 속한 달**에 준다 — 달을 넘는 주는 앞뒤 달 근무를 합쳐 보고, 두 번 주거나 빠뜨리지 않는다.
- **월급제**: 그 달 재직일 ÷ 그 달 일수로 일할 (입사·퇴사한 달). 그 달 이후 입사자는 급여 대상이 아니다.
- **확정**(`confirm`, 사장님): 끝난 달(한국 시간 지난달 이전)만, 최저시급 미만 시급 직원이 있으면 불가 (`MONTH_NOT_ENDED` · `BELOW_MINIMUM_WAGE`). 최저시급 미만이면 근로계약서도 보낼 수 없다. 월급제는 소정근로시간 정보가 없어 최저임금 검사를 하지 않는다.
- **확정 풀기**(`reopen`, 사장님): 명세를 보내기(SENT) 전만 (`PAYROLL_SENT` 409).
- 출근 후 16시간 넘게 퇴근 기록이 없으면 '퇴근 누락'으로 보고 근무 중으로 치지 않는다 — 다음 날 새로 출근할 수 있고, 사장님 화면 `missingClockOut` 에 나온다 (기록 수정으로 고침).
- 매니저는 자기 직원 기록(급여·출퇴근)을 고칠 수 없다 — 사장님만 (`SELF_EDIT_FORBIDDEN`).

### 결제 (`billing/`)

- 구독마다 마지막으로 낸 달(`paid_month`)을 기록해 같은 달에 두 번 결제하지 않는다 — 달 중간에 켠 서비스가 다른 구독의 정기결제를 막지 않고, 껐다 켜도 다시 결제하지 않는다.
- 같은 업장의 결제 작업(카드 등록·정기결제·서비스 켜기)은 PostgreSQL advisory lock 으로 한 번에 하나씩.
- PG 주문번호 = 멱등 키 `wj-<업장id 32자>-<YYYYMM>-<M|상품코드>-<순번>` — 토스에 `Idempotency-Key` 헤더와 `orderId` 로 같이 보낸다.

## 운영 배포

AWS Lightsail 한 대에 화면·API·DB·HTTPS 를 도커로 올립니다 → [../deploy/README.md](../deploy/README.md)

## 규칙

- 업장 데이터 API 는 모두 `:propertyId` 를 받고, `PropertyRoleGuard` 가 구성원·권한을 확인합니다. 남의 업장은 404.
- 권한: 사장님(OWNER) 전체 · 매니저(MANAGER) 홈·리뷰·답글·매출장부·알바·지출 (근로계약서 보내기·급여 확정·구독은 사장님만) · 직원(STAFF) 본인 출퇴근·발주 요청·객실 상태 바꾸기·인수인계 (객실 등록·공지·판매 중지는 사장님·매니저만).
- 운영자 API(`/admin/*`)는 `@AdminOnly()` — 운영자 토큰(typ `admin`)만 통과. 사장님 앱 토큰과 서로 섞어 쓸 수 없습니다.
- 오류 응답: `{ statusCode, message, errorCode }` — 화면은 `errorCode` 로 분기합니다 (`common/errors/app-error.ts`).
  DB 오류도 같은 모양으로 바꿔 준다 (`common/errors/prisma-exception.filter.ts`): 중복 409 `CONFLICT` · 없음 404 `NOT_FOUND` · 형식 오류 400 `BAD_INPUT`.
- 날짜(`YYYY-MM-DD`)·월(`YYYY-MM`)은 달력에 있는 값만 받는다 (2026-02-31 · 2026-13-45 는 400).
- 동시에 두 번 눌러도 한 번만: 답글 게시(리뷰를 '게시 중'으로 먼저 잡음, 실패하면 되돌림) · 영수증 등록 · 발주 입고 · 출근 · 리프레시 토큰 · 객실 상태(다른 사람이 먼저 바꿨으면 409 `ROOM_STATUS_CONFLICT`) · 채널 수집(같은 채널이 수집 중이면 `inProgress: true`).
- 비밀번호(bcrypt)·인증번호·리프레시 토큰·초대 토큰은 해시로만, 채널 계정 정보는 암호화해서만 저장합니다.
