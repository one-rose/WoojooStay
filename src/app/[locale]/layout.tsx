import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getHomeContent, isLocale, LOCALES, localePath } from "@/core";
import { homeContentRepository } from "@/infrastructure";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@/ui/styles/tokens.css";
import "@/ui/styles/global.css";
import "@/ui/styles/base.css";

/**
 * app — 조립 지점(composition root)
 * 저장소(infrastructure)를 유스케이스(core)에 꽂고, 결과를 화면(ui)에 넘긴다.
 * 언어마다 정적 페이지를 하나씩 만든다: / (ko, next.config 의 rewrite) · /en · /ja · /zh
 */

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { meta } = await getHomeContent(homeContentRepository, locale);
  return {
    title: meta.title,
    description: meta.description,
    icons: { icon: "/favicon.svg" },
    alternates: {
      canonical: localePath(locale),
      languages: Object.fromEntries(LOCALES.map((l) => [l, localePath(l)])),
    },
    openGraph: { title: meta.ogTitle, description: meta.ogDescription, type: "website" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
