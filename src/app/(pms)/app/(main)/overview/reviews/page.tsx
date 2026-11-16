import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLiveApi } from "@/infrastructure";
import { LinkedReviewsScreen } from "@/ui/pms";
import { redraftAction, replyAction } from "../../../_lib/actions";
import { loadReviewInbox } from "../../../_lib/portfolio";

export const metadata: Metadata = { title: "통합 리뷰함" };

/** 통합 리뷰함 (F8) — 업장 여러 곳의 리뷰를 한 목록에서 답글. 업장이 1곳이면 그 업장 리뷰 관리로 */
export default function ReviewInboxPage() {
  return (
    <Suspense fallback={<div className="pm-skeleton" aria-busy="true" aria-label="불러오는 중" />}>
      <Inbox />
    </Suspense>
  );
}

async function Inbox() {
  const inbox = await loadReviewInbox();
  if (inbox.properties.length < 2) redirect("/app/reviews");
  return (
    <LinkedReviewsScreen
      reviews={inbox.reviews}
      channels={inbox.channels}
      inbox={{ properties: inbox.properties, truncated: inbox.truncated }}
      actions={isLiveApi ? { reply: replyAction, redraft: redraftAction } : undefined}
    />
  );
}
