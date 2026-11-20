"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { ReviewsScreen } from "./ReviewsScreen";

/**
 * 주소의 ?id= 를 읽어 해당 리뷰를 열어 둔다. 통합 리뷰함은 ?property= 로 업장을 걸러서 연다.
 * 페이지에서 <Suspense> 로 감싸 쓴다.
 */
export function LinkedReviewsScreen(
  props: Omit<ComponentProps<typeof ReviewsScreen>, "initialId" | "initialProperty" | "initialTab">,
) {
  const params = useSearchParams();
  const id = params.get("id");
  const property = params.get("property");
  const tab = params.get("tab");
  return (
    <ReviewsScreen
      key={`${id ?? "none"}:${property ?? "all"}:${tab ?? ""}`}
      {...props}
      initialId={id}
      initialProperty={property}
      initialTab={tab}
    />
  );
}
