-- 모바일 앱: 앱 → 웹 화면 넘기기 1회용 코드 (60초)
-- CreateTable
CREATE TABLE "wj_web_handoff" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "property_id" UUID,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_ip" TEXT,
    "used_ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_web_handoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wj_web_handoff_code_hash_key" ON "wj_web_handoff"("code_hash");

-- CreateIndex
CREATE INDEX "wj_web_handoff_user_id_created_at_idx" ON "wj_web_handoff"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "wj_web_handoff" ADD CONSTRAINT "wj_web_handoff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "wj_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

