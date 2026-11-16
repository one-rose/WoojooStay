"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { ReviewsScreen } from "./ReviewsScreen";

/** 주소의 ?id= 를 읽어 해당 리뷰를 열어 둔다. 페이지에서 <Suspense> 로 감싸 쓴다. */
export function LinkedReviewsScreen(props: Omit<ComponentProps<typeof ReviewsScreen>, "initialId">) {
  const id = useSearchParams().get("id");
  return <ReviewsScreen key={id ?? "none"} {...props} initialId={id} />;
}
