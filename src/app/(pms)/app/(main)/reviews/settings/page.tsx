import { Suspense } from "react";
import type { Metadata } from "next";
import { isLiveApi } from "@/infrastructure";
import { ReplySettingsScreen } from "@/ui/pms";
import { saveReplySettingsAction } from "../../../_lib/actions";
import { getRepository } from "../../../_lib/session";

export const metadata: Metadata = { title: "답글 말투 설정" };

export default function ReplySettingsPage() {
  return (
    <Suspense fallback={<div className="pm-skeleton" aria-busy="true" aria-label="불러오는 중" />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const repo = await getRepository();
  return (
    <ReplySettingsScreen
      initial={await repo.getReplySettings()}
      onSave={isLiveApi ? saveReplySettingsAction : undefined}
    />
  );
}
