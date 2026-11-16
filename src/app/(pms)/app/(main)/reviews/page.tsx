import { Suspense } from "react";
import type { Metadata } from "next";
import { isLiveApi } from "@/infrastructure";
import { LinkedReviewsScreen } from "@/ui/pms";
import { redraftAction, replyAction } from "../../_lib/actions";
import { getRepository } from "../../_lib/session";

export const metadata: Metadata = { title: "AI 리뷰 관리" };

export default function ReviewsPage() {
  return (
    <Suspense fallback={<div className="pm-skeleton" aria-busy="true" aria-label="불러오는 중" />}>
      <Reviews />
    </Suspense>
  );
}

async function Reviews() {
  const repo = await getRepository();
  const [reviews, channels] = await Promise.all([repo.getReviews(), repo.getChannels()]);
  return (
    <LinkedReviewsScreen
      reviews={reviews}
      channels={channels}
      actions={isLiveApi ? { reply: replyAction, redraft: redraftAction } : undefined}
    />
  );
}
