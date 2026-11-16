-- 리뷰 답글 게시 중 상태 (동시 게시 방지)
ALTER TYPE "wj_review_status" ADD VALUE 'POSTING';

-- PG 주문번호 = 멱등 키
ALTER TABLE "wj_payment" ADD COLUMN     "order_no" TEXT;
CREATE UNIQUE INDEX "wj_payment_order_no_key" ON "wj_payment"("order_no");

-- 구독별 마지막 결제 달
ALTER TABLE "wj_subscription" ADD COLUMN     "paid_month" DATE;

-- 이미 결제된 구독은 그 업장의 마지막 결제 달로 채운다
UPDATE "wj_subscription" s
SET "paid_month" = (
  SELECT max(p."billed_month") FROM "wj_payment" p
  WHERE p."property_id" = s."property_id" AND p."status" = 'PAID'
)
WHERE s."status" = 'ACTIVE';

-- AI 답글 초안을 다시 만든 횟수
ALTER TABLE "wj_review_reply_draft" ADD COLUMN     "revision_no" INTEGER NOT NULL DEFAULT 0;
