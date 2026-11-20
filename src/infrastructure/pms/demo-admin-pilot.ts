import type { AdminActivation, AdminAttention, AdminPilotKpi, AdminPilotWeek } from "@/core";
import { addDays, kstDay } from "@/shared";

/**
 * 체험 모드 운영자 화면 — 실증 KPI · 연락할 곳 예시 (실서버의 /admin/pilot · /admin/attention 과 같은 모양).
 * 시작일은 늘 오늘 − 10일 (2주 차 진행 중).
 */

const GROUP = "대전 1차";
const NAMES = [
  "RAINBOW HOTEL",
  "저스트슬립호텔 대전유성온천점",
  "루오 호텔 대흥점",
  "브라운도트 호텔 대덕점",
  "N7 호텔",
];

const DEFINITIONS = {
  week: "실증 시작일부터 7일씩 1~8주. 기준선은 시작 전 90일.",
  responseRate:
    "그 주에 채널에 올라온 리뷰 중 우주스테이로 답글을 단 비율. 수집할 때 채널에 이미 답글이 있던 리뷰는 빼고 센다.",
  responseTime:
    "리뷰가 채널에 올라온 시각부터 우주스테이로 답글을 게시한 시각까지의 중앙값(시간). 그 주에 올라온 리뷰 기준.",
  draftAsIs: "그 주에 게시한 답글 중 AI 초안을 고치지 않고 그대로 게시한 비율 (공백 차이는 같은 문장으로 봄).",
  activeDays: "사장님·매니저가 앱을 열거나 기능을 쓴 날 수 (한국 날짜 기준).",
  ledgerDays: "매출장부·전체 현황·업장 비교를 본 날 수.",
  expenseDigital: "그 주 지출 중 영수증 사진·카드 내역·발주로 들어온 비율 (직접 입력 제외).",
  attendanceApp: "그 주 출근 기록 중 앱으로 찍고 나중에 고치지 않은 비율.",
  rating: "그 주 마지막으로 수집한 채널별 평점의 평균. 변화는 기준선 마지막 값과 비교.",
  aiUsage: "초안 생성(수집 때 자동) · 다시 쓰기 · 답글 게시 건수.",
};

const r3 = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 1000 : null);

function activation(done: number, start: string): AdminActivation {
  const keys = ["SIGNUP", "PROPERTY", "CHANNEL", "FIRST_SYNC", "FIRST_REPLY"] as const;
  const labels = ["가입", "업장 등록", "채널 연결", "첫 수집", "첫 답글"];
  const steps = keys.map((key, i) => ({
    key,
    label: labels[i],
    done: i < done,
    at: i < done ? `${addDays(start, i - 3)} 10:00` : null,
  }));
  return {
    stage: keys[Math.max(0, done - 1)],
    blocked: done >= keys.length ? null : keys[done],
    stuckSince: done >= keys.length ? null : addDays(start, done - 4),
    steps,
  };
}

function weeks(i: number, start: string, today: string, channels: number): AdminPilotWeek[] {
  return Array.from({ length: 9 }, (_, w) => {
    const from = w === 0 ? addDays(start, -90) : addDays(start, (w - 1) * 7);
    const to = w === 0 ? addDays(start, -1) : addDays(start, w * 7 - 1);
    if (from > today) return { week: w, from, to, days: 0, partial: false, future: true };
    const end = to < today ? to : today;
    const days = Math.round((Date.parse(end) - Date.parse(from)) / 86_400_000) + 1;
    if (channels === 0)
      return { week: w, from, to, days, partial: days < (w === 0 ? 90 : 7), future: false, reviews: 0, answered: 0 };
    const reviews = w === 0 ? 22 * channels : Math.round(days * channels * 0.33);
    const answered = w === 0 ? 0 : Math.round(reviews * (0.72 + w * 0.1 - i * 0.04));
    const withDraft = answered;
    const asIs = Math.round(withDraft * (0.52 + w * 0.1));
    const expenses = w === 0 ? 30 : Math.round(days * 0.35);
    const digital = w === 0 ? 6 : Math.round(expenses * 0.8);
    const att = w === 0 ? 0 : days * 3;
    const ratingBase = 4.12 + i * 0.07;
    return {
      week: w,
      from,
      to,
      days,
      partial: days < (w === 0 ? 90 : 7),
      future: false,
      reviews,
      answered,
      responseRate: r3(answered, reviews),
      medianResponseHours: w === 0 ? null : Math.round((19 - w * 7 + i * 1.3) * 10) / 10,
      repliesWithDraft: withDraft,
      draftAsIs: asIs,
      draftAsIsRate: r3(asIs, withDraft),
      activeDays: w === 0 ? 0 : Math.min(days, days - (i % 2)),
      ledgerDays: w === 0 ? 0 : Math.max(1, Math.round(days * (0.45 + i * 0.05))),
      expenses,
      digitalExpenses: digital,
      expenseDigitalRate: r3(digital, expenses),
      payrollConfirmed: w === 1 ? 3 - (i % 2) : 0,
      payslipsSent: w === 1 ? 3 - (i % 2) : 0,
      contractsSigned: w === 1 ? 2 : w === 2 ? 1 : 0,
      attendance: att,
      attendanceApp: Math.round(att * 0.86),
      attendanceAppRate: r3(Math.round(att * 0.86), att),
      rating: Math.round((ratingBase + (w === 0 ? 0 : w * 0.06)) * 100) / 100,
      ratingDelta: w === 0 ? null : Math.round(w * 0.06 * 100) / 100,
      aiDrafts: w === 0 ? 0 : reviews,
      aiRegenerations: w === 0 ? 0 : Math.round(answered * 0.2),
      aiPosts: w === 0 ? 0 : answered,
    };
  });
}

export function demoAdminPilot(today = kstDay(new Date().toISOString())): AdminPilotKpi {
  const start = addDays(today, -10);
  const endsAt = addDays(start, 55);
  const channels = [4, 5, 3, 2, 0];
  return {
    today,
    groups: [{ name: GROUP, properties: NAMES.length }],
    group: GROUP,
    weeks: 8,
    definitions: DEFINITIONS,
    properties: NAMES.map((name, i) => ({
      id: `demo-pilot-${i + 1}`,
      name,
      owner: { name: "한소영", phone: "01020000000", lastLoginAt: `${today} 08:1${i}` },
      lastLoginAt: i === 4 ? `${addDays(today, -4)} 19:20` : `${today} 08:1${i}`,
      pilot: { group: GROUP, startedAt: start, endsAt, active: true, week: 2 },
      activation: activation(i === 4 ? 2 : 5, start),
      survey:
        i < 3
          ? {
              channelCheckMinutes: [70, 90, 45][i],
              payrollMethod: ["엑셀", "세무사 위탁", "수기 장부"][i],
              payrollMinutes: [240, 120, 300][i],
              staffCount: [6, 8, 3][i],
              monthlyExpenseCount: [45, 60, 30][i],
              recordMethod: ["엑셀 + 영수증 보관함", "회계 프로그램", "수기 장부"][i],
              baselineMemo: null,
              satisfaction4w: null,
              satisfaction8w: null,
              satisfactionMemo: null,
              wtpPlan: i < 2 ? "베이직" : null,
              wtpProperties: i < 2 ? 1 : null,
              wtpMemo: null,
            }
          : null,
      weeks: weeks(i, start, today, channels[i]),
    })),
  };
}

export function demoAdminAttention(today = kstDay(new Date().toISOString())): AdminAttention {
  return {
    rules: { noChannelHours: 72, unansweredHours: 48, noLoginDays: 3 },
    items: [
      {
        property: { id: "demo-pilot-5", name: "N7 호텔", pilotGroup: GROUP },
        owner: { id: "demo-owner", name: "한소영", phone: "01020000000" },
        manager: { id: "demo-admin", name: "운영팀" },
        lastLoginAt: `${addDays(today, -4)} 19:20`,
        reasons: [
          { kind: "NO_CHANNEL", text: "가입 72시간이 지나도록 채널을 연결하지 않았어요." },
          { kind: "NO_LOGIN", text: "3일 넘게 접속하지 않았어요." },
        ],
      },
      {
        property: { id: "demo-pilot-4", name: "브라운도트 호텔 대덕점", pilotGroup: GROUP },
        owner: { id: "demo-owner", name: "한소영", phone: "01020000000" },
        manager: { id: "demo-admin", name: "운영팀" },
        lastLoginAt: `${today} 08:13`,
        reasons: [{ kind: "UNANSWERED", text: "48시간 넘게 답글을 기다리는 리뷰가 3건 있어요." }],
      },
      {
        property: { id: "demo-9", name: "솔바람 펜션", pilotGroup: null },
        owner: { id: "demo-owner-2", name: "박준호", phone: "01098765432" },
        manager: null,
        lastLoginAt: null,
        reasons: [
          { kind: "NO_CHANNEL", text: "가입 72시간이 지나도록 채널을 연결하지 않았어요." },
          { kind: "NO_LOGIN", text: "가입 뒤 접속 기록이 없어요." },
        ],
      },
    ],
  };
}
