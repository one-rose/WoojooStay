/**
 * infrastructure — 바깥 세계와 닿는 구현 (정적 데이터, 추후 CMS·API 등)
 * 규칙: ui · app 을 import 하지 않는다. (eslint 로 강제)
 */
import { StaticHomeContentRepository } from "./home/static-home-content.repository";

export { COLOR_SCHEMES, findColorScheme } from "./brand/color-schemes";

/** 앱 전체에서 쓰는 저장소 인스턴스 (구현 교체는 여기서만) */
export const homeContentRepository = new StaticHomeContentRepository();
