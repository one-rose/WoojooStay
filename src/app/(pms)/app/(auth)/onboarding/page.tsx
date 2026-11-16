import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ApiAuthError, isLiveApi, pmsRepository, toPlanOptions } from "@/infrastructure";
import { OnboardingScreen } from "@/ui/pms";
import {
  checkBizNoAction,
  connectChannelAction,
  createPropertyAction,
  finishOnboardingAction,
  setPlanAction,
} from "../../_lib/actions";
import { cookies } from "next/headers";
import { COOKIE, redirectToRefresh, requireSession, serverApi } from "../../_lib/session";

export const metadata: Metadata = { title: "시작하기" };

const actions = isLiveApi
  ? {
      checkBizNo: checkBizNoAction,
      createProperty: createPropertyAction,
      connectChannel: connectChannelAction,
      setPlan: setPlanAction,
      finish: finishOnboardingAction,
    }
  : undefined;

export default function OnboardingPage({ searchParams }: PageProps<"/app/onboarding">) {
  return (
    <Suspense fallback={<div className="pm-loading" aria-busy="true" aria-label="불러오는 중" />}>
      <Onboarding searchParams={searchParams} />
    </Suspense>
  );
}

/**
 * 가입 직후 업장 등록 — 이미 업장이 있으면 홈으로 (중복 등록 방지).
 * 업장을 하나 더 등록할 때만 ?add=1 로 들어온다.
 */
async function Onboarding({ searchParams }: { searchParams: PageProps<"/app/onboarding">["searchParams"] }) {
  const { add } = await searchParams;
  // 채널 목록은 고정 목록이라 예시 저장소에서 가져온다
  const [channels, sample] = await Promise.all([pmsRepository.getChannels(), pmsRepository.getSettings()]);
  let plans = sample.plans;
  let samplePrices = true;
  let resume = false;
  if (isLiveApi) {
    const s = await requireSession();
    const api = await serverApi(s.accessToken);
    const [me, live] = await Promise.all([
      // 깨진 토큰이면 업장 등록 폼 대신 갱신·로그인으로
      api.me().catch(async (e: unknown) => {
        if (e instanceof ApiAuthError) await redirectToRefresh({ next: "/app/onboarding", stale: true });
        return null;
      }),
      api.plans().catch(() => null),
    ]);
    const owned = me?.properties.some((p) => p.role !== "STAFF");
    // 방금 등록한 업장의 온보딩을 이어서 하는 중이면 채널 연결 단계부터
    const inProgress = (await cookies()).get(COOKIE.onboarding)?.value;
    resume = Boolean(inProgress && inProgress === s.propertyId && me?.properties.some((p) => p.id === inProgress));
    if (owned && add !== "1" && !resume) redirect("/app");
    if (live?.length) {
      plans = toPlanOptions(live);
      samplePrices = false;
    }
  }
  return (
    <OnboardingScreen
      channels={channels}
      plans={plans}
      samplePrices={samplePrices}
      actions={actions}
      initialStep={resume ? 1 : 0}
    />
  );
}
