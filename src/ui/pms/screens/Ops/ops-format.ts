import type { OpsNote, RoomStatus } from "@/core";
import type { BadgeTone } from "../../components";

/** 상태 이름과 색 — 색만으로 구분하지 않도록 늘 글자와 같이 쓴다 */
export const ROOM_LABEL: Record<RoomStatus, { label: string; short: string; tone: BadgeTone }> = {
  dirty: { label: "청소 필요", short: "청소 필요", tone: "bad" },
  cleaning: { label: "청소 중", short: "청소 중", tone: "warn" },
  inspect: { label: "점검 대기", short: "점검 대기", tone: "info" },
  ready: { label: "판매 가능", short: "판매 가능", tone: "ok" },
  occupied: { label: "투숙 중", short: "투숙 중", tone: "neutral" },
  outOfOrder: { label: "판매 중지", short: "판매 중지", tone: "neutral" },
};

/** 다음 단계 버튼 문구 */
export const NEXT_LABEL: Partial<Record<RoomStatus, string>> = {
  occupied: "퇴실한 방 처리",
  dirty: "청소 시작",
  cleaning: "청소 끝, 점검 요청",
  inspect: "점검 끝, 판매 가능",
};

/** 상태를 바꾼 뒤 알림 문구 — "206호 점검 요청했어요" */
export const DONE_LABEL: Partial<Record<RoomStatus, string>> = {
  dirty: "퇴실 처리했어요",
  cleaning: "청소 시작했어요",
  inspect: "점검 요청했어요",
  ready: "판매 가능으로 바꿨어요",
};

export const SHIFT_LABEL: Record<NonNullable<OpsNote["shift"]>, string> = { day: "주간", night: "야간" };

const KST = { timeZone: "Asia/Seoul" } as const;

export const hm = (iso: string) =>
  new Date(iso).toLocaleTimeString("ko-KR", { ...KST, hour: "2-digit", minute: "2-digit", hour12: false });

const kstDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", KST); // YYYY-MM-DD

/** "오늘" · "어제" · "11.8 (토)" */
export function dayLabel(iso: string, today: string) {
  const d = kstDay(iso);
  if (d === today) return "오늘";
  const y = new Date(`${today}T00:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (d === y.toISOString().slice(0, 10)) return "어제";
  const w = "일월화수목금토"[new Date(`${d}T00:00:00Z`).getUTCDay()];
  return `${Number(d.slice(5, 7))}.${Number(d.slice(8))} (${w})`;
}

/** now 가 없으면(첫 렌더) 시각만 — 서버·브라우저 시각 차이로 화면이 어긋나지 않게 */
export function ago(iso: string, now: number | null) {
  if (now === null) return hm(iso);
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}
