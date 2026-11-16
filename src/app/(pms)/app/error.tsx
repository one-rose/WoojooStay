"use client";

import { ErrorState } from "@/ui/pms";

/** 앱 화면 틀(사이드바·상단 바)을 그리다 난 오류 */
export default function SegmentError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState onRetry={retry} digest={error.digest} homeHref="/app/login" homeLabel="로그인 화면으로" full />;
}
