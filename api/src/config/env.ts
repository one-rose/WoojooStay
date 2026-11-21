import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/** 환경 변수 — 앱 시작 시 검증하고, 틀리면 바로 멈춘다 */
export class Env {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4000;

  /** 화면 주소 (CORS). 쉼표로 여러 개 — 문자로 보내는 링크는 첫 번째 주소로 만든다 */
  @IsString()
  WEB_ORIGIN: string = 'http://localhost:3000';

  /**
   * 화면 서버(Next.js) ↔ API 내부 키. 요청에 x-internal-key 가 이 값과 같으면
   * x-client-ip 헤더를 실제 사용자 IP 로 믿고 요청 제한(throttle)을 그 IP 기준으로 센다.
   */
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @MinLength(32)
  INTERNAL_API_KEY?: string;

  /** 새 업장 무료 체험 일수 (파일럿은 56) */
  @IsInt()
  @Min(1)
  @Max(365)
  TRIAL_DAYS: number = 30;

  /** 운영(production)에서 문자·결제 키 없이 가짜로 띄우려면 일부러 true 로 켠다 */
  @IsBooleanString()
  ALLOW_FAKE_INTEGRATIONS: string = 'false';

  @IsUrl({ protocols: ['postgresql', 'postgres'], require_tld: false })
  DATABASE_URL: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET: string;

  /** base64 로 인코딩한 32바이트 키 */
  @IsString()
  @MinLength(40)
  CREDENTIALS_KEY: string;

  @IsOptional()
  @IsString()
  ANTHROPIC_API_KEY?: string;

  @IsString()
  AI_MODEL: string = 'claude-haiku-5-5';

  @IsBooleanString()
  SYNC_ENABLED: string = 'false';

  /** 급한 알림(저평점 리뷰 · 채널 연동 끊김)을 사장님·매니저 휴대폰 문자로도 보낸다 */
  @IsBooleanString()
  SMS_ALERTS_ENABLED: string = 'false';

  /** 사장님 계정 하나가 하루(한국 날짜)에 보낼 수 있는 초대·초대 다시 보내기·근로계약서 문자 수 */
  @IsInt()
  @Min(1)
  @Max(10_000)
  INVITE_SMS_DAILY_LIMIT: number = 30;

  /** 영수증 사진 저장 폴더 — 운영 서버에서는 도커 볼륨으로 보존 */
  @IsString()
  UPLOAD_DIR: string = './uploads';

  /* ── 외부 연동 — 비워 두면 개발용 가짜로 동작 ── */

  /** 국세청 사업자등록 상태조회 (공공데이터포털 serviceKey, 디코딩된 값) */
  @IsOptional()
  @IsString()
  NTS_SERVICE_KEY?: string;

  /** 알리고 문자 — 세 값이 모두 있어야 실제로 보낸다 (발신번호 사전 등록 · 서버 IP 등록 필요) */
  @IsOptional()
  @IsString()
  ALIGO_API_KEY?: string;

  @IsOptional()
  @IsString()
  ALIGO_USER_ID?: string;

  @IsOptional()
  @IsString()
  SMS_SENDER?: string;

  /** 토스페이먼츠 시크릿 키 (test_sk_… 또는 live_sk_…) — 있으면 실제 빌링 */
  @IsOptional()
  @IsString()
  TOSS_SECRET_KEY?: string;

  /**
   * 앱 푸시 (FCM HTTP v1) — Firebase 서비스 계정 JSON 원문 또는 그 파일 경로.
   * 비워 두면 푸시를 보내지 않고 로그에만 남긴다.
   */
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  FCM_SERVICE_ACCOUNT_JSON?: string;

  /**
   * 출근 QR 서명 키 (32자 이상). 비워 두면 JWT_ACCESS_SECRET 에서 만든 키를 쓴다 —
   * 그 경우 JWT_ACCESS_SECRET 을 바꾸면 인쇄한 출근 QR 을 모두 새로 뽑아야 한다.
   */
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @MinLength(32)
  CLOCK_QR_SECRET?: string;

  /** 앱 강제 업데이트 — 이 버전보다 낮으면 앱이 "업데이트해 주세요" 화면을 띄운다 (x.y.z) */
  @Matches(/^\d+\.\d+\.\d+$/)
  APP_MIN_VERSION_ANDROID: string = '1.0.0';

  @Matches(/^\d+\.\d+\.\d+$/)
  APP_MIN_VERSION_IOS: string = '1.0.0';

  /** 최신 버전 (있으면 앱이 "새 버전이 있어요" 를 한 번 알림) */
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @Matches(/^\d+\.\d+\.\d+$/)
  APP_LATEST_VERSION_ANDROID?: string;

  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @Matches(/^\d+\.\d+\.\d+$/)
  APP_LATEST_VERSION_IOS?: string;

  /** 스토어 주소 (업데이트 버튼) */
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsUrl({ require_tld: false })
  APP_STORE_URL_ANDROID?: string;

  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsUrl({ require_tld: false })
  APP_STORE_URL_IOS?: string;

  /** 앱이 여는 웹 주소 (웹뷰·화면 넘기기). 비워 두면 WEB_ORIGIN 의 첫 번째 주소 */
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  APP_WEB_BASE_URL?: string;

  /** 고객센터 전화 (앱 업데이트·오류 화면) — 비워 두면 앱은 번호를 보이지 않는다 */
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @Matches(/^[\d-]{8,14}$/)
  SUPPORT_PHONE?: string;
}

/** 키가 없어 개발용 가짜로 동작하는 외부 연동 목록 */
export function fakeIntegrations(env: Env): string[] {
  const fakes: string[] = [];
  if (!env.ALIGO_API_KEY || !env.ALIGO_USER_ID || !env.SMS_SENDER)
    fakes.push('문자(ALIGO_API_KEY·ALIGO_USER_ID·SMS_SENDER)');
  if (!env.TOSS_SECRET_KEY) fakes.push('정기결제(TOSS_SECRET_KEY)');
  if (!env.NTS_SERVICE_KEY) fakes.push('사업자 상태조회(NTS_SERVICE_KEY)');
  if (!env.ANTHROPIC_API_KEY) fakes.push('AI 답글(ANTHROPIC_API_KEY)');
  if (!env.FCM_SERVICE_ACCOUNT_JSON) fakes.push('앱 푸시(FCM_SERVICE_ACCOUNT_JSON)');
  return fakes;
}

/** 인증번호·초대 토큰을 응답에 같이 줘도 되는지 — 설정과 실제 프로세스 둘 다 운영이 아닐 때만 */
export function exposeDevSecrets(nodeEnv: Env['NODE_ENV']): boolean {
  return nodeEnv !== 'production' && process.env.NODE_ENV !== 'production';
}

/** 첫 번째 화면 주소 — 문자로 보내는 링크용 (끝 / 제거) */
export function webOrigin(origins: string): string {
  return (origins.split(',')[0] ?? '').trim().replace(/\/+$/, '');
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const env = plainToInstance(Env, raw, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const list = errors.map((e) => `- ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`);
    throw new Error(`환경 변수 설정이 잘못됐습니다.\n${list.join('\n')}`);
  }
  // 운영에서 문자·결제가 조용히 가짜로 돌지 않게 — 일부러 허용(ALLOW_FAKE_INTEGRATIONS=true)할 때만 시작
  if (env.NODE_ENV === 'production' && env.ALLOW_FAKE_INTEGRATIONS !== 'true') {
    const missing: string[] = [];
    if (!env.TOSS_SECRET_KEY) missing.push('TOSS_SECRET_KEY');
    for (const k of ['ALIGO_API_KEY', 'ALIGO_USER_ID', 'SMS_SENDER'] as const) if (!env[k]) missing.push(k);
    if (missing.length) {
      throw new Error(
        `운영(production)인데 외부 연동 키가 없습니다: ${missing.join(', ')}\n` +
          '가짜 연동으로 일부러 띄우려면 ALLOW_FAKE_INTEGRATIONS=true 를 넣으세요.',
      );
    }
  }
  return env;
}
