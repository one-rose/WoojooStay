-- 2차 PO — 실증 측정(사용 기록·평점 기록·설문) · 운영 도구(지원 메모) · 실증 업장 · 채널에 이미 있던 답글(EXTERNAL)
-- AlterEnum
ALTER TYPE "wj_notice_type" ADD VALUE 'SUMMARY';

-- AlterEnum
ALTER TYPE "wj_reply_method" ADD VALUE 'EXTERNAL';

-- AlterTable
ALTER TABLE "wj_property" ADD COLUMN     "pilot_group" TEXT,
ADD COLUMN     "pilot_start_date" DATE;

-- AlterTable
ALTER TABLE "wj_review_reply" ADD COLUMN     "is_draft_edited" BOOLEAN,
ALTER COLUMN "posted_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "wj_subscription" ADD COLUMN     "trial_notice_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "wj_usage_event" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "property_id" UUID,
    "event_kind" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_usage_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_rating_snapshot" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "channel_code" "wj_channel_code" NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "rating" DECIMAL(3,2) NOT NULL,
    "review_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wj_rating_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_support_note" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "admin_id" UUID,
    "note_kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_support_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_pilot_survey" (
    "property_id" UUID NOT NULL,
    "channel_check_min" INTEGER,
    "payroll_method" TEXT,
    "payroll_min" INTEGER,
    "staff_count" INTEGER,
    "monthly_expense_count" INTEGER,
    "record_method" TEXT,
    "baseline_memo" TEXT,
    "satisfaction_4w" INTEGER,
    "satisfaction_8w" INTEGER,
    "satisfaction_memo" TEXT,
    "wtp_plan" TEXT,
    "wtp_property_count" INTEGER,
    "wtp_memo" TEXT,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wj_pilot_survey_pkey" PRIMARY KEY ("property_id")
);

-- CreateIndex
CREATE INDEX "wj_usage_event_property_id_event_kind_created_at_idx" ON "wj_usage_event"("property_id", "event_kind", "created_at");

-- CreateIndex
CREATE INDEX "wj_usage_event_user_id_event_kind_created_at_idx" ON "wj_usage_event"("user_id", "event_kind", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wj_rating_snapshot_property_id_channel_code_snapshot_date_key" ON "wj_rating_snapshot"("property_id", "channel_code", "snapshot_date");

-- CreateIndex
CREATE INDEX "wj_support_note_property_id_created_at_idx" ON "wj_support_note"("property_id", "created_at");

-- CreateIndex
CREATE INDEX "wj_property_pilot_group_idx" ON "wj_property"("pilot_group");

-- AddForeignKey
ALTER TABLE "wj_rating_snapshot" ADD CONSTRAINT "wj_rating_snapshot_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_support_note" ADD CONSTRAINT "wj_support_note_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_support_note" ADD CONSTRAINT "wj_support_note_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "wj_admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_pilot_survey" ADD CONSTRAINT "wj_pilot_survey_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

