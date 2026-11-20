import { addDaysIso, isoDay } from './dates.js';

/** 실증 기간 (주) */
export const PILOT_WEEKS = 8;
/** 기준선 — 실증 시작 전 이만큼 (일) */
export const PILOT_BASELINE_DAYS = 90;

export interface PilotFields {
  pilotGroup: string | null;
  pilotStartedAt: Date | null;
}

/** 실증 정보 — 묶음과 시작일이 모두 있을 때만. endsAt = 마지막 날 (시작일 + 8주 − 1일) */
export function pilotInfo(p: PilotFields, today: string) {
  if (!p.pilotGroup || !p.pilotStartedAt) return null;
  const startedAt = isoDay(p.pilotStartedAt);
  const endsAt = addDaysIso(startedAt, PILOT_WEEKS * 7 - 1);
  return { group: p.pilotGroup, startedAt, endsAt, active: today <= endsAt };
}

/** 실증 기간(시작 전 포함 ~ 끝나는 날까지)이면 결제하지 않는다 */
export function inPilotBillingHold(p: PilotFields, today: string): boolean {
  const info = pilotInfo(p, today);
  return !!info && info.active;
}
