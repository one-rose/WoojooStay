-- 모바일 앱: 업장 위치·출근 반경·출근 QR 키, 출퇴근 요청, 앱 푸시 기기, 직원 개인 알림
-- CreateEnum
CREATE TYPE "wj_clock_request_type" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "wj_clock_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "wj_device_platform" AS ENUM ('ANDROID', 'IOS');

-- AlterEnum
ALTER TYPE "wj_clock_method" ADD VALUE 'REQUEST';

-- AlterTable
ALTER TABLE "wj_attendance" ADD COLUMN     "clock_in_distance_m" INTEGER,
ADD COLUMN     "clock_out_distance_m" INTEGER,
ADD COLUMN     "clock_out_method" "wj_clock_method";

-- AlterTable
ALTER TABLE "wj_notification" ADD COLUMN     "is_personal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "wj_property" ADD COLUMN     "clock_qr_key_ver" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "clock_radius_m" INTEGER NOT NULL DEFAULT 150,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "wj_clock_request" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "request_type" "wj_clock_request_type" NOT NULL,
    "requested_at" TIMESTAMPTZ NOT NULL,
    "reason" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy_m" INTEGER,
    "distance_m" INTEGER,
    "status" "wj_clock_request_status" NOT NULL DEFAULT 'PENDING',
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ,
    "reject_reason" TEXT,
    "attendance_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_clock_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_device" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" "wj_device_platform" NOT NULL,
    "push_token" TEXT NOT NULL,
    "app_version" TEXT,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wj_clock_request_property_id_status_created_at_idx" ON "wj_clock_request"("property_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "wj_clock_request_employee_id_created_at_idx" ON "wj_clock_request"("employee_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wj_device_push_token_key" ON "wj_device"("push_token");

-- CreateIndex
CREATE INDEX "wj_device_user_id_idx" ON "wj_device"("user_id");

-- AddForeignKey
ALTER TABLE "wj_clock_request" ADD CONSTRAINT "wj_clock_request_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_clock_request" ADD CONSTRAINT "wj_clock_request_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "wj_employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_device" ADD CONSTRAINT "wj_device_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "wj_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

