import { Injectable, Logger } from '@nestjs/common';
import { isValidBizNo } from '../common/utils/biz-no.js';

export type BizStatus = 'ACTIVE' | 'CLOSED' | 'INVALID';

/** 사업자 진위·상태 확인 — 국세청 사업자등록 상태조회 API 연결 시 이 클래스만 교체 (F0-02) */
export abstract class BizVerifier {
  abstract check(bizNo: string): Promise<BizStatus>;
}

/** 지금은 검증번호(체크섬)만 확인한다 */
@Injectable()
export class ChecksumBizVerifier extends BizVerifier {
  async check(bizNo: string): Promise<BizStatus> {
    return isValidBizNo(bizNo) ? 'ACTIVE' : 'INVALID';
  }
}

/**
 * 국세청 사업자등록정보 상태조회 (공공데이터포털 · odcloud)
 * b_stt_cd: 01 계속사업자 · 02 휴업자 · 03 폐업자 · 빈 값 = 국세청에 없는 번호
 * 국세청 서버가 응답하지 않으면 가입을 막지 않도록 검증번호 결과로 대신한다 (로그만 남김).
 */
export class NtsBizVerifier extends BizVerifier {
  private readonly logger = new Logger('NtsBizVerifier');

  constructor(
    private readonly serviceKey: string,
    private readonly endpoint = 'https://api.odcloud.kr/api/nts-businessman/v1/status',
  ) {
    super();
  }

  async check(bizNo: string): Promise<BizStatus> {
    if (!isValidBizNo(bizNo)) return 'INVALID';
    try {
      const res = await fetch(`${this.endpoint}?serviceKey=${encodeURIComponent(this.serviceKey)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ b_no: [bizNo] }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data?: { b_stt_cd?: string }[] };
      const code = body.data?.[0]?.b_stt_cd ?? '';
      if (code === '01') return 'ACTIVE';
      if (code === '02' || code === '03') return 'CLOSED';
      return 'INVALID';
    } catch (e) {
      this.logger.warn(`국세청 상태조회 실패 — 검증번호로 대신 확인: ${(e as Error).message}`);
      return 'ACTIVE';
    }
  }
}
