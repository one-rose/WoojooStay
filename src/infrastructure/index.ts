/**
 * infrastructure — 바깥 세계와 닿는 구현 (현재 정적 콘텐츠, 추후 CMS·API 등)
 * 규칙: ui · app 을 import 하지 않는다. (eslint 로 강제)
 */
import { StaticHomeContentRepository } from "./home/static-home-content.repository";
import { ApiPmsRepository } from "./pms/api/api-pms.repository";
import { PmsApiClient } from "./pms/api/client";
import { toAdminData } from "./pms/api/mappers";
import { demoRepository, shiftDates } from "./pms/demo-clock";
import { demoPropertyRepository } from "./pms/demo-portfolio";
import { StaticPmsRepository } from "./pms/static-pms.repository";

/** 앱 전체에서 쓰는 저장소 인스턴스 (구현 교체는 여기서만) */
export const homeContentRepository = new StaticHomeContentRepository();

/** 우주스테이 앱(/app) 예시 데이터 저장소 — API 주소가 없을 때 (체험 모드: 날짜를 오늘 기준으로 옮김) */
export const pmsRepository = demoRepository(new StaticPmsRepository());

/** 체험 모드 — 고른 예시 업장(쿠키)의 이름·객실 수로 보이는 저장소 */
export function demoPmsRepository(propertyId: string | undefined) {
  return demoPropertyRepository(pmsRepository, propertyId);
}
export { demoPortfolio, demoPropertyOptions, findDemoProperty, DEMO_DEFAULT_PROPERTY } from "./pms/demo-portfolio";

/** 체험 모드 — 화면에서 직접 만든 예시 데이터도 오늘 기준으로 */
export { shiftDates as demoDates };

/** 서버 환경 변수 PMS_API_URL 이 있으면 실서버(NestJS API)와 연결 */
export const PMS_API_URL = process.env.PMS_API_URL ?? "";
export const isLiveApi = PMS_API_URL !== "";

/** 서버 간 호출 키 — 있으면 모든 API 호출에 x-internal-key · x-client-ip 를 붙인다 */
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "";

/** clientIp: 실제 사용자 IP (app 레이어가 요청 머리글에서 꺼내 넘긴다) */
export function pmsApi(token?: string, clientIp?: string) {
  const client = new PmsApiClient(PMS_API_URL, undefined, {
    internalKey: INTERNAL_API_KEY || undefined,
    clientIp,
  });
  return token ? client.withToken(token) : client;
}

export function livePmsRepository(token: string, propertyId: string, clientIp?: string) {
  return new ApiPmsRepository(pmsApi(token, clientIp), propertyId);
}

export {
  ApiAuthError,
  ApiError,
  type ApiChannel,
  type ApiMe,
  type ApiPlanCode,
  type ApiStaffMe,
  type ApiTokens,
} from "./pms/api/client";
export {
  fromReplySettings,
  toAdminData,
  toApiChannel,
  toApiRoomStatus,
  toOps,
  toPlanOptions,
  toPortfolio,
  toPropertyType,
  toReview,
  toRoomLog,
  toStaffMe,
} from "./pms/api/mappers";

/** 운영자 백오피스 데이터 (운영자 토큰) */
export async function loadAdminData(token: string) {
  const api = pmsApi(token);
  const [me, overview, properties, syncIssues, inquiries] = await Promise.all([
    api.adminMe(),
    api.adminOverview(),
    api.adminProperties(),
    api.adminSyncIssues(),
    api.adminInquiries(),
  ]);
  return toAdminData({ me, overview, properties, syncIssues, inquiries: inquiries.items });
}
