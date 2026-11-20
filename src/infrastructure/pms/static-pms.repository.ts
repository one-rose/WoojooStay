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
  type StaffMonthAttendance,
  type StaffMonthDay,
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

  /**
   * 예시 — 직원 한 명의 한 달 출퇴근. 이번 주 근무표 요일 패턴을 그 달에 되풀이해 만든다.
   * today 를 받아 그 날 기준으로 만든다 (체험 모드 저장소가 실제 오늘을 넘긴다 — 날짜를 다시 옮기지 않음).
   */
  async getStaffMonth(staffId: string, month: string, today: string = TODAY): Promise<StaffMonthAttendance> {
    const member = B.STAFF.find((m) => m.id === staffId);
    if (!member) throw new Error("직원을 찾을 수 없어요.");
    const pattern = B.WEEK_SHIFTS[staffId] ?? [];
    const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
    const days: StaffMonthDay[] = [];
    let n = 0;
    for (let d = 1; d <= last; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      if (date > today || date < member.joined) continue;
      const shift = pattern[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7] ?? "unset";
      if (shift !== "day" && shift !== "night") continue;
      n += 1;
      const night = shift === "night";
      if (date === today) {
        const t = B.TODAY_ATTENDANCE.find((a) => a.staffId === staffId);
        const tin = t && "in" in t ? t.in : undefined;
        const tout = t && "out" in t ? t.out : undefined;
        days.push({
          date,
          shift,
          in: tin,
          out: tout,
          hours: tout ? (night ? 9 : 7) : undefined,
          edited: false,
          status: tout ? "done" : tin ? (t?.status === "missing-out" ? "missing-out" : "working") : "scheduled",
        });
        continue;
      }
      // 몇 날은 기록 없음 · 고친 기록 · 퇴근 누락이 섞이게
      if (n % 9 === 5) {
        days.push({ date, shift, edited: false, status: "absent" });
        continue;
      }
      const edited = n % 7 === 3;
      const late = n % 4 === 1 ? 6 : 0;
      days.push({
        date,
        shift,
        in: night ? `22:0${late ? 4 : 0}` : `0${late ? 9 : 8}:${late ? "06" : "55"}`,
        out: night ? "07:02" : edited ? "16:00" : "16:03",
        hours: night ? 9 : 7,
        edited,
        memo: edited ? "퇴근 버튼 누름 깜빡함" : undefined,
        editedBy: edited ? "정현" : undefined,
        status: "done",
      });
    }
    const done = days.filter((x) => x.hours !== undefined);
    return {
      month,
      staffId,
      name: member.name,
      locked: false,
      totalHours: done.reduce((s, x) => s + (x.hours ?? 0), 0),
      workedDays: days.filter((x) => x.in).length,
      days,
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
