import {
  computePayroll,
  ledgerTotals,
  type AdminData,
  type ChannelAccount,
  type ChannelConnection,
  type DashboardData,
  type ExpenseData,
  type GuestReview,
  type LedgerData,
  type OpsData,
  type PmsRepository,
  type RateGrid,
  type ReplySettings,
  type SettingsData,
  type StaffData,
} from "@/core";
import { addDays, daysBetween } from "@/shared";
import * as B from "./business-data";
import {
  CHANNEL_SALES,
  CHANNELS,
  PROPERTY,
  RATE_DAYS,
  REVIEWS,
  ROOM_TYPES,
  SETTLEMENTS,
  TODAY,
  TODAY_SALES,
  sampleCells,
} from "./sample-data";

/** 예시 데이터를 돌려주는 저장소 — 채널 연동 API 가 생기면 이 클래스만 교체 */
export class StaticPmsRepository implements PmsRepository {
  async getDashboard(): Promise<DashboardData> {
    const unanswered = REVIEWS.filter((r) => r.status === "unanswered");
    return {
      date: TODAY,
      property: PROPERTY,
      todaySales: TODAY_SALES,
      unanswered: { total: unanswered.length, lowRating: unanswered.filter((r) => r.rating <= 3).length },
      settlementWeek: {
        amount: SETTLEMENTS.reduce((sum, s) => sum + s.amount, 0),
        count: SETTLEMENTS.length,
      },
      channelSales: CHANNEL_SALES,
      settlements: SETTLEMENTS,
      channels: CHANNELS,
    };
  }

  async getChannels(): Promise<readonly ChannelConnection[]> {
    return CHANNELS;
  }

  async getChannelAccounts(): Promise<readonly ChannelAccount[]> {
    return CHANNELS.map((c) => ({ ...c, connected: true, authExpired: c.status === "error" }));
  }

  async getReviews(): Promise<readonly GuestReview[]> {
    return REVIEWS;
  }

  async getRateGrid(): Promise<RateGrid> {
    return {
      startDate: TODAY,
      dates: Array.from({ length: RATE_DAYS }, (_, i) => addDays(TODAY, i)),
      roomTypes: ROOM_TYPES,
      cells: sampleCells(),
    };
  }

  async getReplySettings(): Promise<ReplySettings> {
    return B.REPLY_SETTINGS;
  }

  async getLedger(): Promise<LedgerData> {
    const totals = ledgerTotals(B.LEDGER_CHANNELS);
    const settleSoon = B.SETTLE_DAYS.filter((d) => {
      const n = daysBetween(TODAY, d.date);
      return n >= 0 && n <= 14;
    }).reduce((sum, d) => sum + d.items.reduce((s, i) => s + i.amount, 0), 0);
    return {
      month: B.LEDGER_MONTH,
      ...totals,
      prevSales: B.PREV_MONTH_SALES,
      settleSoon,
      trend: B.LEDGER_TREND,
      channels: B.LEDGER_CHANNELS,
      calendar: { month: "2026-11", days: B.SETTLE_DAYS },
      priceCompare: B.PRICE_COMPARE,
      stayMix: B.STAY_MIX,
    };
  }

  async getStaff(): Promise<StaffData> {
    const payroll = B.STAFF.map((m) => {
      const [hours, night, weeks] = B.MONTH_HOURS[m.id];
      return computePayroll(m, hours, night, weeks);
    });
    return {
      date: TODAY,
      month: "2026-10",
      minimumWage: B.MINIMUM_WAGE,
      members: B.STAFF,
      today: B.TODAY_ATTENDANCE,
      monthHours: Object.fromEntries(Object.entries(B.MONTH_HOURS).map(([id, [h]]) => [id, h])),
      week: { dates: Array.from({ length: 7 }, (_, i) => addDays(B.WEEK_START, i)), shifts: B.WEEK_SHIFTS },
      payroll,
    };
  }

  async getExpenses(): Promise<ExpenseData> {
    return {
      month: B.EXPENSE_MONTH,
      prevTotal: B.EXPENSE_PREV_TOTAL,
      sales: ledgerTotals(B.LEDGER_CHANNELS).sales,
      items: B.EXPENSES,
      orders: B.ORDERS,
      receiptSample: { vendor: "조식 식자재(가락시장)", date: "2026-11-10", amount: 184_500, category: "food" },
    };
  }

  async getOps(): Promise<OpsData> {
    return { ...B.OPS, rooms: B.OPS_ROOMS };
  }

  async getSettings(): Promise<SettingsData> {
    return B.SETTINGS;
  }

  async getAdmin(): Promise<AdminData> {
    return B.ADMIN;
  }
}
