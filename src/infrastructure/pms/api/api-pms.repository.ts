import type {
  ChannelAccount,
  ChannelConnection,
  DashboardData,
  ExpenseData,
  GuestReview,
  LedgerData,
  NotificationItem,
  OpsData,
  PmsRepository,
  ReplySettings,
  SettingsData,
  StaffData,
  StaffMonthAttendance,
} from "@/core";
import { StaticPmsRepository } from "../static-pms.repository";
import type { PmsApiClient } from "./client";
import {
  toChannelAccounts,
  toDashboard,
  toExpenses,
  toLedger,
  toNotification,
  toOps,
  toReplySettings,
  toReview,
  toSettings,
  toStaff,
  toStaffMonth,
} from "./mappers";

/**
 * 실서버(API) 저장소 — 홈·리뷰·답글 설정·채널·알림·매출장부·알바·지출·현장 업무·설정은 API 에서,
 * 아직 API 가 없는 화면(요금·재고)은 예시 데이터를 그대로 쓴다. 운영자 화면은 /admin 에서 따로 읽는다.
 */
export class ApiPmsRepository extends StaticPmsRepository implements PmsRepository {
  private dashboardCache?: Promise<DashboardData>;

  constructor(
    private readonly api: PmsApiClient,
    private readonly propertyId: string,
  ) {
    super();
  }

  override getDashboard(): Promise<DashboardData> {
    this.dashboardCache ??= this.api.dashboard(this.propertyId).then(toDashboard);
    return this.dashboardCache;
  }

  override async getChannels(): Promise<readonly ChannelConnection[]> {
    return (await this.getDashboard()).channels;
  }

  override async getChannelAccounts(): Promise<readonly ChannelAccount[]> {
    const [list, dash] = await Promise.all([this.api.channels(this.propertyId), this.getDashboard()]);
    return toChannelAccounts(list, dash.date);
  }

  override async getReviews(): Promise<readonly GuestReview[]> {
    return (await this.api.allReviews(this.propertyId)).map(toReview);
  }

  override async getReplySettings(): Promise<ReplySettings> {
    return toReplySettings(await this.api.replySettings(this.propertyId));
  }

  override async getLedger(month?: string): Promise<LedgerData> {
    return toLedger(await this.api.ledger(this.propertyId, month));
  }

  override async getStaff(date?: string, week?: string): Promise<StaffData> {
    return toStaff(await this.api.staff(this.propertyId, date, week));
  }

  override async getStaffMonth(staffId: string, month: string): Promise<StaffMonthAttendance> {
    return toStaffMonth(await this.api.staffMonth(this.propertyId, staffId, month));
  }

  override async getExpenses(month?: string): Promise<ExpenseData> {
    const [d, base] = await Promise.all([this.api.expenses(this.propertyId, month), super.getExpenses()]);
    return toExpenses(d, base.receiptSample);
  }

  override async getOps(): Promise<OpsData> {
    return toOps(await this.api.ops(this.propertyId));
  }

  /**
   * 업장 정보·직원 계정·구독·알림 — 구독은 사장님만 볼 수 있어(매니저는 403) 못 받으면 비워 둔다.
   * 예시 구독 값(super.getSettings)이 섞이지 않게 toSettings 가 billing null 을 빈 값으로 채운다.
   */
  override async getSettings(): Promise<SettingsData> {
    const [base, noti, property, members, billing, notices] = await Promise.all([
      super.getSettings(),
      this.getNotifications(),
      this.api.property(this.propertyId),
      this.api.members(this.propertyId),
      this.api.billing(this.propertyId).catch(() => null),
      this.api.noticeSettings(this.propertyId),
    ]);
    return { ...toSettings(base, { property, members, billing, notices }), notifications: noti };
  }

  async getNotifications(): Promise<NotificationItem[]> {
    return (await this.api.notifications(this.propertyId)).items.map(toNotification);
  }
}
