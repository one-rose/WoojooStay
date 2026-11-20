import type { ActionResult } from "./pms";

/* ── 운영자 백오피스 — 실증 측정 · 운영 도구 (2차 PO) ───────────────── */

/** 활성화 단계 — 가입 → 업장 등록 → 채널 연결 → 첫 수집 → 첫 답글 */
export type AdminActivationStep = "SIGNUP" | "PROPERTY" | "CHANNEL" | "FIRST_SYNC" | "FIRST_REPLY";

export interface AdminActivation {
  /** 마친 마지막 단계 */
  stage: AdminActivationStep;
  /** 아직 못 마친 첫 단계 (다 마쳤으면 null) */
  blocked: AdminActivationStep | null;
  /** 막힌 단계 바로 앞 단계를 마친 날 (YYYY-MM-DD) */
  stuckSince: string | null;
  steps: readonly { key: AdminActivationStep; label: string; done: boolean; at: string | null }[];
}

export interface AdminPilotInfo {
  group: string;
  startedAt: string;
  endsAt: string;
  active: boolean;
}

/** 실증 설문 값 — 기준선 · 만족도 · 지불의사 */
export interface AdminPilotSurvey {
  channelCheckMinutes: number | null;
  payrollMethod: string | null;
  payrollMinutes: number | null;
  staffCount: number | null;
  monthlyExpenseCount: number | null;
  recordMethod: string | null;
  baselineMemo: string | null;
  satisfaction4w: number | null;
  satisfaction8w: number | null;
  satisfactionMemo: string | null;
  wtpPlan: string | null;
  wtpProperties: number | null;
  wtpMemo: string | null;
}

/** 한 주 (week 0 = 기준선) — future 면 숫자 없음 */
export interface AdminPilotWeek {
  week: number;
  from: string;
  to: string;
  days: number;
  partial: boolean;
  future: boolean;
  reviews?: number;
  answered?: number;
  responseRate?: number | null;
  medianResponseHours?: number | null;
  repliesWithDraft?: number;
  draftAsIs?: number;
  draftAsIsRate?: number | null;
  activeDays?: number;
  ledgerDays?: number;
  expenses?: number;
  digitalExpenses?: number;
  expenseDigitalRate?: number | null;
  payrollConfirmed?: number;
  payslipsSent?: number;
  contractsSigned?: number;
  attendance?: number;
  attendanceApp?: number;
  attendanceAppRate?: number | null;
  rating?: number | null;
  ratingDelta?: number | null;
  aiDrafts?: number;
  aiRegenerations?: number;
  aiPosts?: number;
}

export interface AdminPilotProperty {
  id: string;
  name: string;
  owner: { name: string; phone: string; lastLoginAt: string | null } | null;
  /** 사장님·매니저 중 가장 최근 접속 (YYYY-MM-DD HH:mm) */
  lastLoginAt: string | null;
  pilot: AdminPilotInfo & { week: number };
  activation: AdminActivation | null;
  survey: AdminPilotSurvey | null;
  weeks: readonly AdminPilotWeek[];
}

export interface AdminPilotKpi {
  today: string;
  groups: readonly { name: string; properties: number }[];
  group: string | null;
  weeks: number;
  /** 화면에 고정해 보여 주는 정의 문구 */
  definitions: Record<string, string>;
  properties: readonly AdminPilotProperty[];
}

export type AdminAttentionKind = "NO_CHANNEL" | "UNANSWERED" | "NO_LOGIN";

/** 운영팀이 전화할 곳 */
export interface AdminAttention {
  rules: { noChannelHours: number; unansweredHours: number; noLoginDays: number };
  items: readonly {
    property: { id: string; name: string; pilotGroup: string | null };
    owner: { id: string; name: string; phone: string } | null;
    manager: { id: string; name: string } | null;
    lastLoginAt: string | null;
    reasons: readonly { kind: AdminAttentionKind; text: string }[];
  }[];
}

export type AdminSupportNoteKind = "CALL" | "VISIT" | "ETC";

export interface AdminSupportNote {
  id: string;
  kind: AdminSupportNoteKind;
  body: string;
  /** YYYY-MM-DD HH:mm (한국 시간) */
  at: string;
  admin: { id: string; name: string } | null;
}

/** 업장 상세에 더해 보이는 실증·운영 정보 */
export interface AdminPropertyPilotDetail {
  pilot: AdminPilotInfo | null;
  survey: AdminPilotSurvey | null;
  activation: AdminActivation | null;
  aiUsage: readonly { month: string; drafts: number; regenerations: number; posts: number }[];
  notes: readonly AdminSupportNote[];
}

export interface AdminPilotActions {
  /** group null 이면 해제 */
  setPilot: (propertyId: string, group: string | null, startedAt?: string) => Promise<ActionResult>;
  saveSurvey: (propertyId: string, survey: Partial<AdminPilotSurvey>) => Promise<ActionResult<AdminPilotSurvey>>;
  addNote: (propertyId: string, kind: AdminSupportNoteKind, body: string) => Promise<ActionResult<AdminSupportNote>>;
  removeNote: (propertyId: string, noteId: string) => Promise<ActionResult>;
  /** 다른 묶음 KPI 다시 불러오기 */
  loadPilot: (group?: string) => Promise<ActionResult<AdminPilotKpi>>;
}
