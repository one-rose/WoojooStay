"use server";

import { ApiError, pmsApi } from "@/infrastructure";
import type { InquiryInput } from "@/ui/sections";

/** 랜딩 도입·파트너 문의 → API 서버 (로그인 없음) */
export async function submitInquiryAction(input: InquiryInput): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await pmsApi().createInquiry(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof ApiError && e.status === 400 ? e.message : "" };
  }
}
