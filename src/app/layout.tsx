import type { Metadata, Viewport } from "next";
import { getHomeContent } from "@/core";
import { siteConfig } from "@/config/site";
import { COLOR_SCHEMES, homeContentRepository } from "@/infrastructure";
import { buildSchemeStylesheet, restoreSchemeScript, SchemeSwitcher, type SchemeOption } from "@/ui/scheme";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@/ui/styles/tokens.css";
import "@/ui/styles/base.css";

/**
 * app — 조립 지점(composition root)
 * 저장소(infrastructure)를 유스케이스(core)에 꽂고, 결과를 화면(ui)에 넘긴다.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = await getHomeContent(homeContentRepository);
  return {
    title: meta.title,
    description: meta.description,
    openGraph: { title: meta.title, description: meta.description, locale: "ko_KR", type: "website" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const schemeStylesheet = buildSchemeStylesheet(COLOR_SCHEMES, siteConfig.defaultScheme);
const schemeIds = COLOR_SCHEMES.map((scheme) => scheme.id);
const schemeOptions: SchemeOption[] = COLOR_SCHEMES.map(({ id, code, name, description, swatch }) => ({
  id,
  code,
  name,
  description,
  swatch,
}));

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { defaultScheme, schemeSwitcherEnabled } = siteConfig;
  return (
    // data-scheme 은 저장된 시안을 복원하는 스크립트가 그리기 전에 바꾸므로 경고를 끈다
    <html lang="ko" data-scheme={defaultScheme} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: schemeStylesheet }} />
        {schemeSwitcherEnabled && <script dangerouslySetInnerHTML={{ __html: restoreSchemeScript(schemeIds) }} />}
      </head>
      <body>
        {children}
        {schemeSwitcherEnabled && <SchemeSwitcher options={schemeOptions} defaultId={defaultScheme} />}
      </body>
    </html>
  );
}
