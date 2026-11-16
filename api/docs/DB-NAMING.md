# DB 이름 규칙

정식 공공 표준용어 사전을 그대로 따르지는 않고, 국내 기업 개발에서 흔히 쓰는 영문 약어·접미어 수준으로 맞췄습니다.
코드(Prisma 모델·필드)는 camelCase 를 쓰고, `prisma/schema.prisma` 의 `@@map` / `@map` 으로 아래 DB 이름에 연결합니다.

## 규칙

| 대상 | 규칙 | 예 |
| --- | --- | --- |
| 테이블 | `wj_` + 단수 명사 snake_case | `wj_user`, `wj_property_member` |
| 기본키 | `id` (uuid) | |
| 외래키 | `<대상>_id` | `property_id`, `employee_id` |
| 작성·수정자 | `created_by`, `edited_by`, `posted_by` … | |
| 시각 | `*_at` (timestamptz) | `created_at`, `posted_at`, `clock_in_at` |
| 날짜 | `*_date` (date) | `checkin_date`, `expense_date`, `work_date` |
| 월 | `*_month` (그 달 1일, date) | `spend_month`, `pay_month` |
| 여부 | `is_*` (boolean) | `is_settled`, `is_auto_reply` |
| 금액 | `*_amount` (원, 정수) | `sale_amount`, `total_amount` |
| 단가·가격 | `*_price` | `sale_price`, `monthly_price` |
| 개수 | `*_count` | `room_count`, `attempt_count` |
| 코드 | `*_code` | `channel_code`, `plan_code` |
| 이름 | `<대상>_name` | `user_name`, `property_name`, `vendor_name` |
| 번호 | `*_no` | `phone_no`, `reservation_no`, `biz_reg_no` |
| 상태 | `status` (테이블마다 하나) | |
| 암호화·해시 | `*_enc`, `*_hash` | `credential_enc`, `password_hash` |
| enum 타입 | `wj_` + snake_case | `wj_member_role`, `wj_channel_code` |

## 테이블 목록

| 테이블 | 내용 | 기능 ID |
| --- | --- | --- |
| `wj_user` | 사장님·직원 앱 계정 | F0-01 |
| `wj_phone_verification` | 휴대폰 인증번호 (해시) | F0-01 |
| `wj_refresh_token` | 로그인 유지 토큰 (해시) | F0-01 |
| `wj_admin_user` | 운영자 계정 | F0-14 |
| `wj_inquiry` | 도입·파트너 문의 | F0-16 |
| `wj_property` | 업장 | F0-02 |
| `wj_property_member` | 업장 구성원·권한 | F0-03 |
| `wj_member_invitation` | 직원 초대 | F0-03 |
| `wj_channel_account` | 채널 연결 (계정 암호화) | F0-04 |
| `wj_booking` | 채널 예약 — 매출 원천 | F0-06 |
| `wj_settlement` | 채널 정산 예정·완료 | F0-07 |
| `wj_ad_spend` | 월 광고비 | F2-04 |
| `wj_channel_price` | 채널 노출 판매가 | F2-05 |
| `wj_competitor_price` | 주변 경쟁 업소 가격 | F2-05 |
| `wj_review` | 고객 리뷰 | F1-01 |
| `wj_review_reply_draft` | AI 답글 초안 | F1-03 |
| `wj_review_reply` | 게시한 답글 | F1-07 |
| `wj_reply_setting` | 답글 말투·자동 응대 | F1-04, F1-08 |
| `wj_notification` | 앱 안 알림 | F0-13 |
| `wj_notification_setting` | 알림 받기 설정 | F0-13 |
| `wj_plan` | 구독 상품 (기준 데이터) | F0-08 |
| `wj_subscription` | 업장별 구독 | F0-08 |
| `wj_payment_method` | 결제 카드 (빌링키 암호화) | F0-09 |
| `wj_payment` | 결제 내역 | F0-09 |
| `wj_employee` | 직원 | F5-01 |
| `wj_labor_contract` | 근로계약서 | F5-06 |
| `wj_attendance` | 출퇴근 | F5-02 |
| `wj_work_shift` | 교대 스케줄 | F5-03 |
| `wj_payroll` | 월 급여 | F5-04 |
| `wj_room` | 객실(호실) · 현재 상태 | F7-01 |
| `wj_room_status_log` | 객실 상태 변경 이력 | F7-01 |
| `wj_ops_note` | 교대 인수인계 · 공지 | F7-02, F7-03 |
| `wj_ops_note_read` | 인수인계·공지 확인 표시 | F7-02, F7-03 |
| `wj_expense` | 지출 | F6-01 |
| `wj_receipt` | 영수증 사진·인식 결과 | F6-03 |
| `wj_purchase_order` | 발주 | F6-04 |
