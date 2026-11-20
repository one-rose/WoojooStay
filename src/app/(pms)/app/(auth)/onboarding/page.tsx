import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ApiAuthError, isLiveApi, pmsRepository, toPlanOptions } from "@/infrastructure";
import { OnboardingScreen } from "@/ui/pms";
import {
  checkBizNoAction,
  connectChannelAction,
  createPropertyAction,
  finishOnboardingAction,
  previewDraftsAction,
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
      previewDrafts: previewDraftsAction,
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
  // 예시 저장소는 날짜를 오늘 기준으로 옮긴다 — 빌드 때 굳히지 않게 요청 시점에
  await connection();
  // 채널 목록은 고정 목록이라 예시 저장소에서 가져온다
  const [channels, sample, sampleReviews] = await Promise.all([
    pmsRepository.getChannels(),
    pmsRepository.getSettings(),
    isLiveApi ? Promise.resolve([]) : pmsRepository.getReviews(),
  ]);
  let ownerName = "";
  let trialDays: number | undefined;
  let plans = sample.plans;
  let samplePrices = true;
  let resume = false;
  // 업장 등록 폼 전에 "사장님으로 시작 / 초대받아 일하나요" 먼저 — 업장을 하나 더 등록할 때(?add=1)는 바로 폼
  let intro = add !== "1";
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
    // 직원으로라도 속한 업장이 있으면 이미 알고 쓰는 사람 — 바로 업장 등록 폼
    if (me?.properties.length) intro = false;
    ownerName = me?.name ?? "";
    trialDays = me?.trialDays;
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
      intro={intro && !resume}
      logoutPath={isLiveApi ? "/app/session/logout" : undefined}
      ownerName={ownerName}
      trialDays={trialDays}
      demoSample={
        [...sampleReviews].filter((r) => r.status === "unanswered").sort((a, b) => a.rating - b.rating)[0] ?? null
      }
    />
  );
}
