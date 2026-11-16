import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SETTINGS_SECTIONS, SettingsScreen, isSettingsSection } from "@/ui/pms";
import { isLiveApi } from "@/infrastructure";
import {
  changeRoleAction,
  connectChannelAction,
  disconnectChannelAction,
  inviteAction,
  registerCardAction,
  saveNoticesAction,
  savePropertyAction,
  setPlanAction,
  syncChannelAction,
} from "../../../_lib/actions";
import { getRepository, readSession } from "../../../_lib/session";

/** 카드 등록 결과 코드 → 고정 문구 (주소에 든 임의 글자를 화면에 그대로 띄우지 않는다) */
const CARD_ERRORS: Record<string, string> = {
  cancel: "카드 등록을 취소했어요.",
  mismatch: "카드 등록 정보가 맞지 않아요. 다시 시도해 주세요.",
  failed: "카드를 등록하지 못했어요. 카드 정보를 확인하고 다시 시도해 주세요.",
};

/** 토스페이먼츠 클라이언트 키 (test_ck_… / live_ck_…) — 없으면 개발용 테스트 카드 */
const TOSS_CLIENT_KEY = process.env.TOSS_CLIENT_KEY ?? "";

export function generateStaticParams() {
  return SETTINGS_SECTIONS.map((s) => ({ section: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/app/settings/[section]">): Promise<Metadata> {
  const { section } = await params;
  const label = SETTINGS_SECTIONS.find((s) => s.id === section)?.label ?? "설정";
  return { title: `설정 · ${label}` };
}

export default function SettingsPage({ params, searchParams }: PageProps<"/app/settings/[section]">) {
  return (
    <Suspense fallback={<div className="pm-skeleton" aria-busy="true" aria-label="불러오는 중" />}>
      <Settings params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Settings({
  params,
  searchParams,
}: {
  params: PageProps<"/app/settings/[section]">["params"];
  searchParams: PageProps<"/app/settings/[section]">["searchParams"];
}) {
  const { section } = await params;
  if (!isSettingsSection(section)) notFound();
  const repo = await getRepository();
  const [data, channels] = await Promise.all([repo.getSettings(), repo.getChannelAccounts()]);
  let cardAuth: { clientKey: string; customerKey: string } | undefined;
  let cardResult: { ok: boolean; message: string } | undefined;
  if (section === "billing" && isLiveApi) {
    const { propertyId } = await readSession();
    if (TOSS_CLIENT_KEY && propertyId) cardAuth = { clientKey: TOSS_CLIENT_KEY, customerKey: propertyId };
    const q = await searchParams;
    if (q.card === "ok") cardResult = { ok: true, message: "결제 카드를 등록했어요." };
    else if (typeof q.cardError === "string")
      cardResult = { ok: false, message: CARD_ERRORS[q.cardError] ?? CARD_ERRORS.failed };
  }
  return (
    <SettingsScreen
      section={section}
      data={data}
      channels={channels}
      cardAuth={cardAuth}
      cardResult={cardResult}
      actions={
        isLiveApi
          ? {
              saveProperty: savePropertyAction,
              invite: inviteAction,
              setPlan: setPlanAction,
              registerCard: registerCardAction,
              saveNotices: saveNoticesAction,
              connectChannel: connectChannelAction,
              syncChannel: syncChannelAction,
              disconnectChannel: disconnectChannelAction,
              changeRole: changeRoleAction,
            }
          : undefined
      }
    />
  );
}
