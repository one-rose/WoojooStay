import type { HomeContent } from "./home-content";
import type { HomeContentRepository } from "./home-content.repository";

export const DEFAULT_LOCALE = "ko";

/** 유스케이스: 홈 화면 콘텐츠 조회 */
export async function getHomeContent(
  repository: HomeContentRepository,
  locale: string = DEFAULT_LOCALE,
): Promise<HomeContent> {
  return repository.get(locale);
}
