import type { HomeContent, HomeContentRepository } from "@/core";
import { homeContentKo } from "./home-content.ko";

const CONTENT_BY_LOCALE: Record<string, HomeContent> = {
  ko: homeContentKo,
};

/** 코드에 들어 있는 정적 콘텐츠를 돌려주는 저장소 구현 */
export class StaticHomeContentRepository implements HomeContentRepository {
  async get(locale: string): Promise<HomeContent> {
    const content = CONTENT_BY_LOCALE[locale];
    if (!content) throw new Error(`홈 콘텐츠가 없는 언어입니다: ${locale}`);
    return content;
  }
}
