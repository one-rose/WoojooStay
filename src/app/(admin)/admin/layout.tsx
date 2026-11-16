import type { Metadata, Viewport } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@/ui/styles/tokens.css";
import "@/ui/styles/global.css";
import "@/ui/pms/styles/pms-tokens.css";
import "@/ui/pms/styles/pms-base.css";
import "@/ui/pms/components/Form/form.css";
import "@/ui/pms/components/Table/table.css";

/**
 * 운영팀 백오피스(/admin) — 사장님 앱(/app)과 별도 root layout
 * 운영자 계정(이메일 + 비밀번호)으로만 들어온다. 검색 노출 막음.
 */
export const metadata: Metadata = {
  title: { default: "운영 백오피스", template: "%s · 우주스테이 운영" },
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1c2b46" };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="pm">{children}</body>
    </html>
  );
}
