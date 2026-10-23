/**
 * infrastructure — 바깥 세계와 닿는 구현 (현재 정적 콘텐츠, 추후 CMS·API 등)
 * 규칙: ui · app 을 import 하지 않는다. (eslint 로 강제)
 */
import { StaticHomeContentRepository } from "./home/static-home-content.repository";

/** 앱 전체에서 쓰는 저장소 인스턴스 (구현 교체는 여기서만) */
export const homeContentRepository = new StaticHomeContentRepository();
