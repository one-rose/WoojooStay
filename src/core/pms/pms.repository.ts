import type {
  AdminData,
  ClockQrData,
  ExpenseData,
  LedgerData,
  OpsData,
  ReplySettings,
  SettingsData,
  StaffData,
  StaffMonthAttendance,
} from "./business";
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
  /** date: 이 날짜 기준 (급여는 그 달) — 없으면 오늘 · week: 교대표를 볼 주(그 날이 속한 월요일 시작 주) */
  getStaff(date?: string, week?: string): Promise<StaffData>;
  /** 직원 한 명의 한 달 출퇴근 (month: "YYYY-MM") — 근태 '이번 달 기록' */
  getStaffMonth(staffId: string, month: string): Promise<StaffMonthAttendance>;
  /** month: "YYYY-MM" (없으면 이번 달) */
  getExpenses(month?: string): Promise<ExpenseData>;
  getOps(): Promise<OpsData>;
  getSettings(): Promise<SettingsData>;
  /** 출근 QR (인쇄용) — 사장님·매니저 */
  getClockQr(): Promise<ClockQrData>;
  getAdmin(): Promise<AdminData>;
}
