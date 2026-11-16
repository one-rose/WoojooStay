-- CreateEnum
CREATE TYPE "wj_verification_purpose" AS ENUM ('SIGNUP', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "wj_admin_role" AS ENUM ('SUPER', 'OPERATOR');

-- CreateEnum
CREATE TYPE "wj_inquiry_type" AS ENUM ('INTRO', 'PARTNER');

-- CreateEnum
CREATE TYPE "wj_inquiry_status" AS ENUM ('NEW', 'CONTACTED', 'DONE');

-- CreateEnum
CREATE TYPE "wj_property_type" AS ENUM ('HOTEL', 'MOTEL', 'PENSION', 'GUESTHOUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "wj_member_role" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "wj_channel_code" AS ENUM ('YANOLJA', 'YEOGI', 'NAVER', 'AGODA', 'TRIP', 'HOTELS', 'ONDA', 'KKUL', 'DDNAYO');

-- CreateEnum
CREATE TYPE "wj_channel_status" AS ENUM ('CONNECTED', 'SYNCING', 'AUTH_EXPIRED', 'ERROR');

-- CreateEnum
CREATE TYPE "wj_stay_type" AS ENUM ('OVERNIGHT', 'DAYUSE');

-- CreateEnum
CREATE TYPE "wj_booking_status" AS ENUM ('CONFIRMED', 'CANCELLED', 'NOSHOW');

-- CreateEnum
CREATE TYPE "wj_data_source" AS ENUM ('CHANNEL', 'MANUAL');

-- CreateEnum
CREATE TYPE "wj_review_status" AS ENUM ('UNANSWERED', 'POSTED');

-- CreateEnum
CREATE TYPE "wj_sentiment" AS ENUM ('POSITIVE', 'IMPROVE');

-- CreateEnum
CREATE TYPE "wj_reply_method" AS ENUM ('API', 'COPY', 'AUTO');

-- CreateEnum
CREATE TYPE "wj_reply_tone" AS ENUM ('POLITE', 'FRIENDLY');

-- CreateEnum
CREATE TYPE "wj_auto_reply_hours" AS ENUM ('ALWAYS', 'DAYTIME');

-- CreateEnum
CREATE TYPE "wj_notice_type" AS ENUM ('REVIEW', 'SETTLE', 'SYNC', 'BILLING', 'STAFF');

-- CreateEnum
CREATE TYPE "wj_plan_code" AS ENUM ('REVIEW', 'LEDGER', 'STAFF', 'EXPENSE', 'FINANCE');

-- CreateEnum
CREATE TYPE "wj_subscription_status" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "wj_payment_status" AS ENUM ('PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "wj_job_role" AS ENUM ('MANAGER', 'FRONT', 'NIGHT', 'HOUSEKEEPING');

-- CreateEnum
CREATE TYPE "wj_pay_type" AS ENUM ('HOURLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "wj_contract_status" AS ENUM ('SENT', 'SIGNED');

-- CreateEnum
CREATE TYPE "wj_clock_method" AS ENUM ('GPS', 'QR', 'MANUAL');

-- CreateEnum
CREATE TYPE "wj_shift_type" AS ENUM ('DAY', 'NIGHT', 'OFF');

-- CreateEnum
CREATE TYPE "wj_payroll_status" AS ENUM ('DRAFT', 'CONFIRMED', 'SENT');

-- CreateEnum
CREATE TYPE "wj_expense_category" AS ENUM ('AMENITY', 'UTILITY', 'LAUNDRY', 'FOOD', 'REPAIR', 'TAX', 'ETC');

-- CreateEnum
CREATE TYPE "wj_expense_source" AS ENUM ('CARD', 'RECEIPT', 'ORDER', 'MANUAL');

-- CreateEnum
CREATE TYPE "wj_receipt_status" AS ENUM ('SCANNED', 'REGISTERED');

-- CreateEnum
CREATE TYPE "wj_order_status" AS ENUM ('REQUESTED', 'ORDERED', 'RECEIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "wj_user" (
    "id" UUID NOT NULL,
    "phone_no" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "terms_agreed_at" TIMESTAMPTZ NOT NULL,
    "privacy_agreed_at" TIMESTAMPTZ NOT NULL,
    "marketing_agreed_at" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wj_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_phone_verification" (
    "id" UUID NOT NULL,
    "phone_no" TEXT NOT NULL,
    "purpose" "wj_verification_purpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_phone_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_refresh_token" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_admin_user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "admin_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "admin_role" "wj_admin_role" NOT NULL DEFAULT 'OPERATOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wj_admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_inquiry" (
    "id" UUID NOT NULL,
    "inquiry_type" "wj_inquiry_type" NOT NULL,
    "contact_name" TEXT NOT NULL,
    "phone_no" TEXT NOT NULL,
    "email" TEXT,
    "property_name" TEXT,
    "property_type" "wj_property_type",
    "room_count" INTEGER,
    "message" TEXT NOT NULL,
    "status" "wj_inquiry_status" NOT NULL DEFAULT 'NEW',
    "admin_memo" TEXT,
    "handled_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wj_inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_property" (
    "id" UUID NOT NULL,
    "property_name" TEXT NOT NULL,
    "property_type" "wj_property_type" NOT NULL,
    "address" TEXT NOT NULL,
    "room_count" INTEGER NOT NULL,
    "biz_reg_no" TEXT NOT NULL,
    "is_biz_verified" BOOLEAN NOT NULL DEFAULT false,
    "owner_name" TEXT NOT NULL,
    "phone_no" TEXT,
    "manager_admin_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wj_property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_property_member" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "member_role" "wj_member_role" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_property_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_member_invitation" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "phone_no" TEXT NOT NULL,
    "member_role" "wj_member_role" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_member_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_channel_account" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "channel_code" "wj_channel_code" NOT NULL,
    "status" "wj_channel_status" NOT NULL DEFAULT 'SYNCING',
    "credential_enc" TEXT NOT NULL,
    "consented_at" TIMESTAMPTZ NOT NULL,
    "last_synced_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wj_channel_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_booking" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "channel_code" "wj_channel_code" NOT NULL,
    "reservation_no" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "room_type_name" TEXT NOT NULL,
    "stay_type" "wj_stay_type" NOT NULL DEFAULT 'OVERNIGHT',
    "checkin_date" DATE NOT NULL,
    "checkout_date" DATE NOT NULL,
    "checkin_time" TEXT,
    "sale_amount" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "commission_amount" INTEGER NOT NULL DEFAULT 0,
    "status" "wj_booking_status" NOT NULL DEFAULT 'CONFIRMED',
    "booked_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wj_booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_settlement" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "channel_code" "wj_channel_code" NOT NULL,
    "settle_date" DATE NOT NULL,
    "settle_amount" INTEGER NOT NULL,
    "is_settled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_ad_spend" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "channel_code" "wj_channel_code" NOT NULL,
    "spend_month" DATE NOT NULL,
    "spend_amount" INTEGER NOT NULL,
    "source" "wj_data_source" NOT NULL DEFAULT 'MANUAL',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wj_ad_spend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_channel_price" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "channel_code" "wj_channel_code" NOT NULL,
    "room_type_name" TEXT NOT NULL,
    "stay_date" DATE NOT NULL,
    "sale_price" INTEGER NOT NULL,
    "collected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_channel_price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_competitor_price" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "competitor_name" TEXT NOT NULL,
    "distance_m" INTEGER NOT NULL,
    "room_type_name" TEXT NOT NULL,
    "stay_date" DATE NOT NULL,
    "sale_price" INTEGER NOT NULL,
    "collected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_competitor_price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_review" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "channel_code" "wj_channel_code" NOT NULL,
    "external_review_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "photo_urls" TEXT[],
    "room_type_name" TEXT,
    "stay_date" DATE,
    "posted_at" TIMESTAMPTZ NOT NULL,
    "status" "wj_review_status" NOT NULL DEFAULT 'UNANSWERED',
    "sentiment" "wj_sentiment" NOT NULL,
    "is_needs_check" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_review_reply_draft" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" TEXT[],
    "generator" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wj_review_reply_draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_review_reply" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "post_method" "wj_reply_method" NOT NULL,
    "posted_by" UUID,
    "posted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_review_reply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_reply_setting" (
    "property_id" UUID NOT NULL,
    "tone" "wj_reply_tone" NOT NULL DEFAULT 'POLITE',
    "signature" TEXT NOT NULL,
    "must_include" TEXT NOT NULL DEFAULT '',
    "banned_words" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_auto_reply" BOOLEAN NOT NULL DEFAULT false,
    "auto_min_rating" INTEGER NOT NULL DEFAULT 4,
    "auto_hours" "wj_auto_reply_hours" NOT NULL DEFAULT 'ALWAYS',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wj_reply_setting_pkey" PRIMARY KEY ("property_id")
);

-- CreateTable
CREATE TABLE "wj_notification" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "user_id" UUID,
    "notice_type" "wj_notice_type" NOT NULL,
    "message" TEXT NOT NULL,
    "link_url" TEXT,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_notification_setting" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "notice_type" "wj_notice_type" NOT NULL,
    "is_alimtalk" BOOLEAN NOT NULL DEFAULT true,
    "is_push" BOOLEAN NOT NULL DEFAULT true,
    "is_email" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wj_notification_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_plan" (
    "plan_code" "wj_plan_code" NOT NULL,
    "plan_name" TEXT NOT NULL,
    "monthly_price" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "stage_label" TEXT NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "wj_plan_pkey" PRIMARY KEY ("plan_code")
);

-- CreateTable
CREATE TABLE "wj_subscription" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "plan_code" "wj_plan_code" NOT NULL,
    "status" "wj_subscription_status" NOT NULL DEFAULT 'TRIAL',
    "trial_end_date" DATE NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMPTZ,

    CONSTRAINT "wj_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_payment_method" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "card_name" TEXT NOT NULL,
    "card_last4" TEXT NOT NULL,
    "billing_key_enc" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_payment_method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_payment" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "billed_month" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "pay_amount" INTEGER NOT NULL,
    "status" "wj_payment_status" NOT NULL,
    "paid_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_employee" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "user_id" UUID,
    "employee_name" TEXT NOT NULL,
    "phone_no" TEXT NOT NULL,
    "job_role" "wj_job_role" NOT NULL,
    "pay_type" "wj_pay_type" NOT NULL,
    "pay_amount" INTEGER NOT NULL,
    "hired_date" DATE NOT NULL,
    "resigned_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wj_employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_labor_contract" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "status" "wj_contract_status" NOT NULL DEFAULT 'SENT',
    "contract_start_date" DATE NOT NULL,
    "pay_type" "wj_pay_type" NOT NULL,
    "pay_amount" INTEGER NOT NULL,
    "sign_token_hash" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signed_at" TIMESTAMPTZ,

    CONSTRAINT "wj_labor_contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_attendance" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "clock_in_at" TIMESTAMPTZ NOT NULL,
    "clock_out_at" TIMESTAMPTZ,
    "clock_method" "wj_clock_method" NOT NULL DEFAULT 'GPS',
    "edited_by" UUID,
    "edited_at" TIMESTAMPTZ,
    "memo" TEXT,

    CONSTRAINT "wj_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_work_shift" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "shift_type" "wj_shift_type" NOT NULL,

    CONSTRAINT "wj_work_shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_payroll" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "pay_month" DATE NOT NULL,
    "work_hours" DECIMAL(6,2) NOT NULL,
    "night_hours" DECIMAL(6,2) NOT NULL,
    "base_amount" INTEGER NOT NULL,
    "night_amount" INTEGER NOT NULL,
    "weekly_holiday_amount" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "status" "wj_payroll_status" NOT NULL DEFAULT 'DRAFT',
    "confirmed_at" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,

    CONSTRAINT "wj_payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_expense" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "expense_date" DATE NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "expense_category" "wj_expense_category" NOT NULL,
    "expense_amount" INTEGER NOT NULL,
    "expense_source" "wj_expense_source" NOT NULL DEFAULT 'MANUAL',
    "memo" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_receipt" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "ocr_vendor_name" TEXT,
    "ocr_expense_date" DATE,
    "ocr_amount" INTEGER,
    "ocr_category" "wj_expense_category",
    "status" "wj_receipt_status" NOT NULL DEFAULT 'SCANNED',
    "expense_id" UUID,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_purchase_order" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "item_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "order_amount" INTEGER NOT NULL,
    "expense_category" "wj_expense_category" NOT NULL DEFAULT 'AMENITY',
    "order_status" "wj_order_status" NOT NULL DEFAULT 'REQUESTED',
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ordered_at" TIMESTAMPTZ,
    "received_at" TIMESTAMPTZ,
    "expense_id" UUID,
    "created_by" UUID,

    CONSTRAINT "wj_purchase_order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wj_user_phone_no_key" ON "wj_user"("phone_no");

-- CreateIndex
CREATE INDEX "wj_phone_verification_phone_no_purpose_created_at_idx" ON "wj_phone_verification"("phone_no", "purpose", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wj_refresh_token_token_hash_key" ON "wj_refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "wj_refresh_token_user_id_idx" ON "wj_refresh_token"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wj_admin_user_email_key" ON "wj_admin_user"("email");

-- CreateIndex
CREATE INDEX "wj_inquiry_status_created_at_idx" ON "wj_inquiry"("status", "created_at");

-- CreateIndex
CREATE INDEX "wj_property_member_property_id_idx" ON "wj_property_member"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "wj_property_member_user_id_property_id_key" ON "wj_property_member"("user_id", "property_id");

-- CreateIndex
CREATE UNIQUE INDEX "wj_member_invitation_token_hash_key" ON "wj_member_invitation"("token_hash");

-- CreateIndex
CREATE INDEX "wj_member_invitation_property_id_idx" ON "wj_member_invitation"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "wj_channel_account_property_id_channel_code_key" ON "wj_channel_account"("property_id", "channel_code");

-- CreateIndex
CREATE INDEX "wj_booking_property_id_checkin_date_idx" ON "wj_booking"("property_id", "checkin_date");

-- CreateIndex
CREATE UNIQUE INDEX "wj_booking_property_id_channel_code_reservation_no_key" ON "wj_booking"("property_id", "channel_code", "reservation_no");

-- CreateIndex
CREATE INDEX "wj_settlement_property_id_settle_date_idx" ON "wj_settlement"("property_id", "settle_date");

-- CreateIndex
CREATE UNIQUE INDEX "wj_ad_spend_property_id_channel_code_spend_month_key" ON "wj_ad_spend"("property_id", "channel_code", "spend_month");

-- CreateIndex
CREATE UNIQUE INDEX "wj_channel_price_property_id_channel_code_room_type_name_st_key" ON "wj_channel_price"("property_id", "channel_code", "room_type_name", "stay_date");

-- CreateIndex
CREATE UNIQUE INDEX "wj_competitor_price_property_id_competitor_name_room_type_n_key" ON "wj_competitor_price"("property_id", "competitor_name", "room_type_name", "stay_date");

-- CreateIndex
CREATE INDEX "wj_review_property_id_status_posted_at_idx" ON "wj_review"("property_id", "status", "posted_at");

-- CreateIndex
CREATE UNIQUE INDEX "wj_review_property_id_channel_code_external_review_id_key" ON "wj_review"("property_id", "channel_code", "external_review_id");

-- CreateIndex
CREATE UNIQUE INDEX "wj_review_reply_draft_review_id_key" ON "wj_review_reply_draft"("review_id");

-- CreateIndex
CREATE UNIQUE INDEX "wj_review_reply_review_id_key" ON "wj_review_reply"("review_id");

-- CreateIndex
CREATE INDEX "wj_notification_property_id_created_at_idx" ON "wj_notification"("property_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wj_notification_setting_user_id_property_id_notice_type_key" ON "wj_notification_setting"("user_id", "property_id", "notice_type");

-- CreateIndex
CREATE UNIQUE INDEX "wj_subscription_property_id_plan_code_key" ON "wj_subscription"("property_id", "plan_code");

-- CreateIndex
CREATE INDEX "wj_payment_property_id_paid_at_idx" ON "wj_payment"("property_id", "paid_at");

-- CreateIndex
CREATE INDEX "wj_employee_property_id_idx" ON "wj_employee"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "wj_labor_contract_sign_token_hash_key" ON "wj_labor_contract"("sign_token_hash");

-- CreateIndex
CREATE INDEX "wj_labor_contract_employee_id_idx" ON "wj_labor_contract"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "wj_attendance_employee_id_work_date_key" ON "wj_attendance"("employee_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "wj_work_shift_employee_id_work_date_key" ON "wj_work_shift"("employee_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "wj_payroll_employee_id_pay_month_key" ON "wj_payroll"("employee_id", "pay_month");

-- CreateIndex
CREATE INDEX "wj_expense_property_id_expense_date_idx" ON "wj_expense"("property_id", "expense_date");

-- CreateIndex
CREATE UNIQUE INDEX "wj_receipt_expense_id_key" ON "wj_receipt"("expense_id");

-- CreateIndex
CREATE UNIQUE INDEX "wj_purchase_order_expense_id_key" ON "wj_purchase_order"("expense_id");

-- CreateIndex
CREATE INDEX "wj_purchase_order_property_id_requested_at_idx" ON "wj_purchase_order"("property_id", "requested_at");

-- AddForeignKey
ALTER TABLE "wj_refresh_token" ADD CONSTRAINT "wj_refresh_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "wj_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_inquiry" ADD CONSTRAINT "wj_inquiry_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "wj_admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_property" ADD CONSTRAINT "wj_property_manager_admin_id_fkey" FOREIGN KEY ("manager_admin_id") REFERENCES "wj_admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_property_member" ADD CONSTRAINT "wj_property_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "wj_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_property_member" ADD CONSTRAINT "wj_property_member_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_member_invitation" ADD CONSTRAINT "wj_member_invitation_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_channel_account" ADD CONSTRAINT "wj_channel_account_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_booking" ADD CONSTRAINT "wj_booking_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_settlement" ADD CONSTRAINT "wj_settlement_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_ad_spend" ADD CONSTRAINT "wj_ad_spend_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_channel_price" ADD CONSTRAINT "wj_channel_price_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_competitor_price" ADD CONSTRAINT "wj_competitor_price_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_review" ADD CONSTRAINT "wj_review_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_review_reply_draft" ADD CONSTRAINT "wj_review_reply_draft_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "wj_review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_review_reply" ADD CONSTRAINT "wj_review_reply_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "wj_review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_review_reply" ADD CONSTRAINT "wj_review_reply_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "wj_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_reply_setting" ADD CONSTRAINT "wj_reply_setting_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_notification" ADD CONSTRAINT "wj_notification_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_notification" ADD CONSTRAINT "wj_notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "wj_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_notification_setting" ADD CONSTRAINT "wj_notification_setting_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "wj_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_notification_setting" ADD CONSTRAINT "wj_notification_setting_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_subscription" ADD CONSTRAINT "wj_subscription_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_subscription" ADD CONSTRAINT "wj_subscription_plan_code_fkey" FOREIGN KEY ("plan_code") REFERENCES "wj_plan"("plan_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_payment_method" ADD CONSTRAINT "wj_payment_method_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_payment" ADD CONSTRAINT "wj_payment_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_employee" ADD CONSTRAINT "wj_employee_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_employee" ADD CONSTRAINT "wj_employee_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "wj_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_labor_contract" ADD CONSTRAINT "wj_labor_contract_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "wj_employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_attendance" ADD CONSTRAINT "wj_attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "wj_employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_work_shift" ADD CONSTRAINT "wj_work_shift_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "wj_employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_payroll" ADD CONSTRAINT "wj_payroll_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "wj_employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_expense" ADD CONSTRAINT "wj_expense_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_receipt" ADD CONSTRAINT "wj_receipt_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_receipt" ADD CONSTRAINT "wj_receipt_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "wj_expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_purchase_order" ADD CONSTRAINT "wj_purchase_order_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_purchase_order" ADD CONSTRAINT "wj_purchase_order_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "wj_expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
