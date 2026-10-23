import type { Locale } from "../i18n/locale";
import type { HomeContent } from "./home-content";

/** 홈 콘텐츠 저장소 — 구현(정적 파일, CMS, API …)은 infrastructure 에 둔다 */
export interface HomeContentRepository {
  get(locale: Locale): Promise<HomeContent>;
}
