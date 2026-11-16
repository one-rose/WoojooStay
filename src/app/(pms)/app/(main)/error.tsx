"use client";

import { ErrorState } from "@/ui/pms";

/** 업무 화면(사이드바 안)에서 난 오류 */
export default function SegmentError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState onRetry={retry} digest={error.digest} homeHref="/app" homeLabel="홈으로" />;
}
