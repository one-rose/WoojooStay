import { notFound } from "next/navigation";
import { getHomeContent, isLocale } from "@/core";
import { homeContentRepository, isLiveApi } from "@/infrastructure";
import { HomeView } from "@/ui/views";
import { submitInquiryAction } from "./actions";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = await getHomeContent(homeContentRepository, locale);
  return <HomeView content={content} locale={locale} submitInquiry={isLiveApi ? submitInquiryAction : undefined} />;
}
