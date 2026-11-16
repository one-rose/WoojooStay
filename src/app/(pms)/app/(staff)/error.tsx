"use client";

import { ErrorState } from "@/ui/pms";

/** 직원 출퇴근 화면 오류 */
export default function SegmentError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState onRetry={retry} digest={error.digest} homeHref="/app/me" homeLabel="출퇴근 화면으로" full />;
}
