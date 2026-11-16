-- CreateEnum
CREATE TYPE "wj_room_status" AS ENUM ('READY', 'OCCUPIED', 'DIRTY', 'CLEANING', 'INSPECT', 'OUT_OF_ORDER');

-- CreateEnum
CREATE TYPE "wj_ops_note_type" AS ENUM ('HANDOVER', 'NOTICE');

-- CreateTable
CREATE TABLE "wj_room" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "room_no" TEXT NOT NULL,
    "floor_no" INTEGER,
    "room_type_name" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "wj_room_status" NOT NULL DEFAULT 'READY',
    "memo" TEXT,
    "status_changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status_changed_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wj_room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_room_status_log" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "from_status" "wj_room_status",
    "to_status" "wj_room_status" NOT NULL,
    "memo" TEXT,
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_room_status_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_ops_note" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "note_type" "wj_ops_note_type" NOT NULL,
    "shift_type" "wj_shift_type",
    "body" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "author_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wj_ops_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wj_ops_note_read" (
    "note_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wj_ops_note_read_pkey" PRIMARY KEY ("note_id","user_id")
);

-- CreateIndex
CREATE INDEX "wj_room_property_id_status_idx" ON "wj_room"("property_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "wj_room_property_id_room_no_key" ON "wj_room"("property_id", "room_no");

-- CreateIndex
CREATE INDEX "wj_room_status_log_room_id_changed_at_idx" ON "wj_room_status_log"("room_id", "changed_at");

-- CreateIndex
CREATE INDEX "wj_ops_note_property_id_note_type_created_at_idx" ON "wj_ops_note"("property_id", "note_type", "created_at");

-- AddForeignKey
ALTER TABLE "wj_room" ADD CONSTRAINT "wj_room_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_room_status_log" ADD CONSTRAINT "wj_room_status_log_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "wj_room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_room_status_log" ADD CONSTRAINT "wj_room_status_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "wj_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_ops_note" ADD CONSTRAINT "wj_ops_note_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "wj_property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_ops_note" ADD CONSTRAINT "wj_ops_note_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "wj_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_ops_note_read" ADD CONSTRAINT "wj_ops_note_read_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "wj_ops_note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wj_ops_note_read" ADD CONSTRAINT "wj_ops_note_read_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "wj_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
