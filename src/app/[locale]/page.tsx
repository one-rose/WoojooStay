import { notFound } from "next/navigation";
import { getHomeContent, isLocale } from "@/core";
import { homeContentRepository } from "@/infrastructure";
import { HomeView } from "@/ui/views";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = await getHomeContent(homeContentRepository, locale);
  return <HomeView content={content} locale={locale} />;
}
