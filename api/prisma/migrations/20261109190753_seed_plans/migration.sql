-- 구독 상품 기본값 (금액은 임시 — 기능정의서 F0-08 '요금제 금액' 결정 필요)
INSERT INTO "wj_plan" ("plan_code", "plan_name", "monthly_price", "description", "stage_label", "is_available", "sort_order") VALUES
  ('REVIEW',  'AI 리뷰 자동답변',              29000, '리뷰 통합 · AI 답글 · 자동 응대',       'NOW',    true,  1),
  ('LEDGER',  '디지털매출장부',                 39000, '월 대시보드 · 정산 캘린더 · 가격 비교', 'NEXT',   true,  2),
  ('STAFF',   '알바관리',                       19000, '근태 · 스케줄 · 급여 · 근로계약서',     '5단계',  true,  3),
  ('EXPENSE', '지출관리',                       19000, '지출 집계 · 영수증 · 발주',             '6단계',  true,  4),
  ('FINANCE', '매출선정산 · 미래매출선지급',        0, '이용 금액에 따른 수수료',               '3·4단계', false, 5)
ON CONFLICT ("plan_code") DO NOTHING;
