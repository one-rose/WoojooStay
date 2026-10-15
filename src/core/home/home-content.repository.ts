import type { HomeContent } from "./home-content";

/**
 * 홈 콘텐츠를 어디서 가져오는지 숨기는 포트(인터페이스).
 * 지금은 정적 데이터(infrastructure/home) 구현을 쓰고,
 * CMS·API로 옮기면 같은 인터페이스의 새 구현만 추가하면 된다.
 */
export interface HomeContentRepository {
  get(locale: string): Promise<HomeContent>;
}
