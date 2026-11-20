-- 초대 묶음 (여러 업장에 함께 보낸 초대만 함께 수락)
ALTER TABLE "wj_member_invitation" ADD COLUMN "batch_id" UUID;
CREATE INDEX "wj_member_invitation_batch_id_idx" ON "wj_member_invitation"("batch_id");

-- 리프레시 토큰: 회전으로 폐기됐는지 (로그아웃·재설정 폐기와 구분)
ALTER TABLE "wj_refresh_token" ADD COLUMN "is_rotated" BOOLEAN NOT NULL DEFAULT false;

-- 사장님이 보내는 문자 기록 (계정별 하루 한도)
CREATE TABLE "wj_sms_send_log" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sms_kind" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_sms_send_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "wj_sms_send_log_user_id_created_at_idx" ON "wj_sms_send_log"("user_id", "created_at");
