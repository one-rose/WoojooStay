import type { HomeContent, HomeContentRepository, Locale } from "@/core";
import { homeContentEn } from "./content/en";
import { homeContentJa } from "./content/ja";
import { homeContentKo } from "./content/ko";
import { homeContentZh } from "./content/zh";

const CONTENT_BY_LOCALE: Record<Locale, HomeContent> = {
  ko: homeContentKo,
  en: homeContentEn,
  ja: homeContentJa,
  zh: homeContentZh,
};

/** 코드에 들어 있는 정적 콘텐츠를 돌려주는 저장소 구현 */
export class StaticHomeContentRepository implements HomeContentRepository {
  async get(locale: Locale): Promise<HomeContent> {
    return CONTENT_BY_LOCALE[locale];
  }
}
