import type { AdminData, ExpenseData, LedgerData, OpsData, ReplySettings, SettingsData, StaffData } from "./business";
import type { ChannelAccount, ChannelConnection, DashboardData, GuestReview } from "./pms";
import type { RateGrid } from "./rates";

/** 앱 데이터 저장소 — 지금은 예시 데이터, 추후 API 로 교체 (구현은 infrastructure) */
export interface PmsRepository {
  getDashboard(): Promise<DashboardData>;
  getChannels(): Promise<readonly ChannelConnection[]>;
  /** 연결 전 채널까지 모든 채널과 연결 상태 */
  getChannelAccounts(): Promise<readonly ChannelAccount[]>;
  getReviews(): Promise<readonly GuestReview[]>;
  getReplySettings(): Promise<ReplySettings>;
  getRateGrid(): Promise<RateGrid>;
  /** month: "YYYY-MM" (없으면 이번 달) */
  getLedger(month?: string): Promise<LedgerData>;
  /** date: 이 날짜 기준 (급여는 그 달) — 없으면 오늘 */
  getStaff(date?: string): Promise<StaffData>;
  getExpenses(): Promise<ExpenseData>;
  getOps(): Promise<OpsData>;
  getSettings(): Promise<SettingsData>;
  getAdmin(): Promise<AdminData>;
}
