import { Suspense } from "react";
import type { Metadata } from "next";
import { isLiveApi } from "@/infrastructure";
import { ReplySettingsScreen, ScreenSkeleton } from "@/ui/pms";
import { saveReplySettingsAction } from "../../../_lib/actions";
import { loadPropertySwitcher } from "../../../_lib/portfolio";
import { getRepository } from "../../../_lib/session";

export const metadata: Metadata = { title: "답글 말투 설정" };

export default function ReplySettingsPage() {
  return (
    <Suspense fallback={<ScreenSkeleton strip={0} rows={4} />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const repo = await getRepository();
  const [initial, switcher] = await Promise.all([repo.getReplySettings(), loadPropertySwitcher()]);
  return (
    <ReplySettingsScreen
      initial={initial}
      onSave={isLiveApi ? saveReplySettingsAction : undefined}
      otherProperties={switcher.options
        .filter((o) => o.id !== switcher.currentId)
        .map((o) => ({ id: o.id, name: o.name }))}
    />
  );
}
