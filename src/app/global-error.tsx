"use client";

import "@/ui/styles/tokens.css";
import "@/ui/pms/styles/pms-tokens.css";
import "@/ui/pms/styles/pms-base.css";
import { ErrorState } from "@/ui/pms";

/** 맨 바깥 틀까지 깨졌을 때 — 영어 기본 화면 대신 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ko">
      <body className="pm">
        <ErrorState full onRetry={retry} digest={error.digest} homeHref="/app" homeLabel="앱 홈으로" />
      </body>
    </html>
  );
}
