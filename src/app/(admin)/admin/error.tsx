"use client";

import { ErrorState } from "@/ui/pms";

/** 운영자 화면 오류 */
export default function SegmentError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState onRetry={retry} digest={error.digest} homeHref="/admin" homeLabel="운영자 홈으로" full />;
}
