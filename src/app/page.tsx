import { getHomeContent } from "@/core";
import { homeContentRepository } from "@/infrastructure";
import { HomeView } from "@/ui/views";

export default async function HomePage() {
  const content = await getHomeContent(homeContentRepository);
  return <HomeView content={content} />;
}
