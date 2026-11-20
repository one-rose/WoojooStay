import type {
  AdminActivation,
  AdminAttention,
  AdminPilotKpi,
  AdminPilotSurvey,
  AdminPilotWeek,
  AdminSupportNote,
} from "@/core";
import type {
  ApiAdminActivation,
  ApiAdminAttention,
  ApiAdminPilotKpi,
  ApiAdminPilotSurvey,
  ApiAdminSupportNote,
} from "./client";

/** 한국 시간 "YYYY-MM-DD HH:mm" (없으면 null) */
export const kstMinute = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16).replace("T", " ") : null;

export function toActivation(a: ApiAdminActivation | null | undefined): AdminActivation | null {
  if (!a) return null;
  return {
    stage: a.stage,
    blocked: a.blocked,
    stuckSince: kstMinute(a.stuckSince)?.slice(0, 10) ?? null,
    steps: a.steps.map((s) => ({ ...s, at: kstMinute(s.at) })),
  };
}

export function toSurvey(s: ApiAdminPilotSurvey | null | undefined): AdminPilotSurvey | null {
  if (!s) return null;
  return {
    channelCheckMinutes: s.channelCheckMinutes,
    payrollMethod: s.payrollMethod,
    payrollMinutes: s.payrollMinutes,
    staffCount: s.staffCount,
    monthlyExpenseCount: s.monthlyExpenseCount,
    recordMethod: s.recordMethod,
    baselineMemo: s.baselineMemo,
    satisfaction4w: s.satisfaction4w,
    satisfaction8w: s.satisfaction8w,
    satisfactionMemo: s.satisfactionMemo,
    wtpPlan: s.wtpPlan,
    wtpProperties: s.wtpProperties,
    wtpMemo: s.wtpMemo,
  };
}

export function toSupportNote(n: ApiAdminSupportNote): AdminSupportNote {
  return { id: n.id, kind: n.kind, body: n.body, at: kstMinute(n.createdAt) ?? "", admin: n.admin };
}

export function toAdminPilotKpi(k: ApiAdminPilotKpi): AdminPilotKpi {
  return {
    today: k.today,
    groups: k.groups,
    group: k.group,
    weeks: k.weeks,
    definitions: k.definitions,
    properties: k.properties.map((p) => ({
      id: p.id,
      name: p.name,
      owner: p.owner ? { ...p.owner, lastLoginAt: kstMinute(p.owner.lastLoginAt) } : null,
      lastLoginAt: kstMinute(p.lastLoginAt),
      pilot: p.pilot,
      activation: toActivation(p.activation),
      survey: toSurvey(p.survey),
      weeks: p.weeks as unknown as AdminPilotWeek[],
    })),
  };
}

export function toAdminAttention(a: ApiAdminAttention): AdminAttention {
  return { rules: a.rules, items: a.items.map((x) => ({ ...x, lastLoginAt: kstMinute(x.lastLoginAt) })) };
}
