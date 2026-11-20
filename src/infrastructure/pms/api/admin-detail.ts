import type { AdminOperator, AdminPropertyDetail } from "@/core";
import type { ApiAdmin, ApiAdminPropertyDetail } from "./client";
import { toActivation, toSupportNote, toSurvey } from "./admin-pilot";
import { toChannelId, toPropertyType } from "./mappers";

/** 운영자 업장 상세 — 날짜는 한국 시간 "YYYY-MM-DD HH:mm" (없으면 null) */
const kst = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16).replace("T", " ") : null;
const ROLE = { OWNER: "owner", MANAGER: "manager", STAFF: "staff" } as const;
const ROLE_ORDER = { owner: 0, manager: 1, staff: 2 } as const;

export function toAdminPropertyDetail(p: ApiAdminPropertyDetail): AdminPropertyDetail {
  return {
    id: p.id,
    name: p.name,
    type: toPropertyType(p.type),
    address: p.address,
    rooms: p.rooms,
    bizNo: p.bizNo,
    bizVerified: p.bizVerified,
    ownerName: p.ownerName,
    joined: p.createdAt.slice(0, 10),
    manager: p.manager,
    subscriptions: p.subscriptions.map((s) => ({
      name: s.planName,
      monthlyPrice: s.monthlyPrice,
      status: s.status,
      trialEndsAt: s.trialEndsAt ? s.trialEndsAt.slice(0, 10) : null,
    })),
    channels: p.channels.map((c) => ({
      channel: toChannelId(c.channel),
      name: c.name,
      status: c.status,
      lastSyncedAt: kst(c.lastSyncedAt),
      lastError: c.lastError,
      fails: c.consecutiveFails,
    })),
    members: p.members
      .map((m) => ({ role: ROLE[m.role], name: m.name, phone: m.phone, lastLoginAt: kst(m.lastLoginAt) }))
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name, "ko")),
    payments: p.payments.map((x) => ({
      id: x.id,
      month: x.billedMonth.slice(0, 7),
      description: x.description,
      amount: x.amount,
      status: x.status,
      paidAt: kst(x.paidAt) ?? "",
    })),
    pilot: p.pilot ?? null,
    survey: toSurvey(p.survey),
    activation: toActivation(p.activation),
    aiUsage: p.aiUsage ?? [],
    notes: (p.notes ?? []).map(toSupportNote),
  };
}

export function toAdminOperators(list: (ApiAdmin & { isActive: boolean })[]): AdminOperator[] {
  return list.map((a) => ({ id: a.id, name: a.name, email: a.email, active: a.isActive }));
}
