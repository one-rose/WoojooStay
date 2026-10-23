import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getHomeContent, isLocale, LOCALES, localePath, type Locale } from "@/core";
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

/** 공유 미리보기 이미지 등 절대 주소의 기준. 도메인이 바뀌면 NEXT_PUBLIC_SITE_URL 로 지정 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://uzustay.vercel.app";

const OG_LOCALE: Record<Locale, string> = { ko: "ko_KR", en: "en_US", ja: "ja_JP", zh: "zh_CN" };

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { meta } = await getHomeContent(homeContentRepository, locale);
  // 카카오톡·슬랙·페이스북 등 링크 공유 시 보이는 이미지 (public/og/<언어>.jpg, 1200×630)
  const image = { url: `/og/${locale}.jpg`, width: 1200, height: 630, alt: meta.ogTitle };
  return {
    metadataBase: new URL(SITE_URL),
    title: meta.title,
    description: meta.description,
    icons: { icon: "/favicon.svg" },
    alternates: {
      canonical: localePath(locale),
      languages: Object.fromEntries(LOCALES.map((l) => [l, localePath(l)])),
    },
    openGraph: {
      type: "website",
      siteName: "WOOJOO STAY",
      url: localePath(locale),
      locale: OG_LOCALE[locale],
      title: meta.ogTitle,
      description: meta.ogDescription,
      images: [image],
    },
    twitter: { card: "summary_large_image", title: meta.ogTitle, description: meta.ogDescription, images: [image] },
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
