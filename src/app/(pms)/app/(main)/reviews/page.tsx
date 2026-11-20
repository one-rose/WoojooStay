import { Suspense } from "react";
import type { Metadata } from "next";
import { isLiveApi } from "@/infrastructure";
import { LinkedReviewsScreen, ScreenSkeleton } from "@/ui/pms";
import { forwardReviewAction, redraftAction, replyAction } from "../../_lib/actions";
import { getRepository } from "../../_lib/session";

export const metadata: Metadata = { title: "리뷰 관리" };

export default function ReviewsPage() {
  return (
    <Suspense fallback={<ScreenSkeleton strip={0} rows={6} />}>
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
      actions={isLiveApi ? { reply: replyAction, redraft: redraftAction, forward: forwardReviewAction } : undefined}
    />
  );
}
