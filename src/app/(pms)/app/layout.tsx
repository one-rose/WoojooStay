import type { Metadata, Viewport } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@/ui/styles/tokens.css";
import "@/ui/styles/global.css";
import "@/ui/pms/styles/pms-tokens.css";
import "@/ui/pms/styles/pms-base.css";
import "@/ui/pms/components/Form/form.css";
import "@/ui/pms/components/Table/table.css";

/**
 * 우주스테이 앱(/app) — 홈페이지(/[locale])와 별도의 root layout
 * (main): 사이드바가 있는 업무 화면 · (auth): 로그인·온보딩
 * 지금은 예시 데이터로 동작하는 화면 시안. 검색 노출 막음.
 */

export const metadata: Metadata = {
  title: { default: "우주스테이", template: "%s · 우주스테이" }, // copy-ok 브라우저 탭 제목 구분
  icons: { icon: "/favicon.svg" },
  manifest: "/app.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "우주스테이", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1c2b46",
};

export default function PmsRootLayout({ children }: LayoutProps<"/app">) {
  return (
    <html lang="ko">
      <body className="pm">{children}</body>
    </html>
  );
}
