"use client";

import { ErrorState } from "@/ui/pms";

/** 로그인·가입·온보딩 화면 오류 */
export default function SegmentError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState onRetry={retry} digest={error.digest} homeHref="/app/login" homeLabel="로그인 화면으로" full />;
}
