import {
  computeMonthlyPay,
  employedDays,
  isBelowMinimumWage,
  minimumWageFor,
  monthWeekRange,
  nightMs,
  sumHours,
  weeklyHolidayHours,
  weeklyHolidayWeeks,
  type Shift,
} from './payroll.js';

const kst = (s: string) => new Date(`${s}+09:00`);
/** 그날 hh 시부터 hours 시간 근무 */
const work = (date: string, hours: number, from = 9): Shift => ({
  workDate: date,
  clockInAt: kst(`${date}T${String(from).padStart(2, '0')}:00:00`),
  clockOutAt: new Date(kst(`${date}T${String(from).padStart(2, '0')}:00:00`).getTime() + hours * 3_600_000),
});
const hourly = (shifts: Shift[], month = '2026-11', amount = 10_320) =>
  computeMonthlyPay({
    month,
    payType: 'HOURLY',
    payAmount: amount,
    hiredDate: '2026-01-01',
    resignedDate: null,
    shifts,
  });

describe('급여 계산 (F5-04)', () => {
  it('야간(22~06시) 겹치는 시간을 센다', () => {
    expect(nightMs(kst('2026-11-03T20:00:00'), kst('2026-11-04T07:00:00')) / 3_600_000).toBe(8);
    expect(nightMs(kst('2026-11-03T09:00:00'), kst('2026-11-03T18:00:00'))).toBe(0);
    expect(nightMs(kst('2026-11-04T01:00:00'), kst('2026-11-04T05:00:00')) / 3_600_000).toBe(4);
  });

  it('근무·야간 시간 합계 — 퇴근 안 찍은 기록은 빼고', () => {
    expect(sumHours([work('2026-11-03', 6), { ...work('2026-11-04', 0), clockOutAt: null }])).toEqual({
      hours: 6,
      nightHours: 0,
    });
  });

  it('주휴 시간 = 주 15시간 이상일 때 min(8, 주시간/40×8)', () => {
    expect(weeklyHolidayHours(14.9)).toBe(0);
    expect(weeklyHolidayHours(15)).toBe(3);
    expect(weeklyHolidayHours(20)).toBe(4);
    expect(weeklyHolidayHours(40)).toBe(8);
    expect(weeklyHolidayHours(52)).toBe(8);
  });

  it('주 18시간 → 주휴 3.6시간분 (예전처럼 8시간 전부 주지 않는다)', () => {
    // 2026-11-02(월) ~ 11-08(일) 주에 6시간 × 3일
    const r = hourly([work('2026-11-03', 6), work('2026-11-04', 6), work('2026-11-05', 6)]);
    expect(r).toMatchObject({
      hours: 18,
      nightHours: 0,
      base: 185_760,
      weekly: Math.round(3.6 * 10_320),
      weeksFull: 1,
    });
    expect(r.total).toBe(r.base + r.night + r.weekly);
  });

  it('주 15시간 미만이면 주휴수당 없음', () => {
    expect(hourly([work('2026-11-03', 7), work('2026-11-04', 7)]).weekly).toBe(0);
  });

  it('달을 넘는 주는 일요일이 있는 달에 한 번만 — 앞뒤 달 근무를 합쳐서 본다', () => {
    // 2026-11-30(월) ~ 12-06(일): 11월 30일 10시간 + 12월 1·2일 10시간씩 = 30시간 → 12월에 6시간분
    const shifts = [work('2026-11-30', 10), work('2026-12-01', 10), work('2026-12-02', 10)];
    expect(weeklyHolidayWeeks('2026-11', shifts)).toEqual([]);
    expect(weeklyHolidayWeeks('2026-12', shifts)).toEqual([{ monday: '2026-11-30', hours: 30, holidayHours: 6 }]);
    const nov = hourly(shifts, '2026-11');
    const dec = hourly(shifts, '2026-12');
    expect(nov.hours).toBe(10); // 근무시간은 그 달 것만
    expect(nov.weekly).toBe(0);
    expect(dec.hours).toBe(20);
    expect(dec.weekly).toBe(6 * 10_320);
    // 2026-10-26(월) ~ 11-01(일): 일요일이 11월 → 11월 몫
    const oct = [work('2026-10-27', 8), work('2026-10-28', 8)];
    expect(hourly(oct, '2026-10').weekly).toBe(0);
    expect(hourly(oct, '2026-11').weekly).toBe(Math.round(3.2 * 10_320));
  });

  it('조회 범위는 첫 주 월요일 ~ 마지막 주 일요일', () => {
    expect(monthWeekRange('2026-11')).toEqual({ from: '2026-10-26', to: '2026-12-06' });
    expect(monthWeekRange('2026-02')).toEqual({ from: '2026-01-26', to: '2026-03-01' });
  });

  it('월급제는 그 달 재직일만큼 — 그 달 이후 입사자는 0', () => {
    const monthly = (hiredDate: string, resignedDate: string | null = null) =>
      computeMonthlyPay({
        month: '2026-11',
        payType: 'MONTHLY',
        payAmount: 3_000_000,
        hiredDate,
        resignedDate,
        shifts: [],
      });
    expect(monthly('2026-01-01').total).toBe(3_000_000);
    expect(monthly('2026-11-16').total).toBe(1_500_000); // 30일 중 15일
    expect(monthly('2026-01-01', '2026-11-10').total).toBe(1_000_000);
    expect(monthly('2027-03-01').total).toBe(0);
    expect(employedDays('2026-11', '2026-12-01', null)).toBe(0);
    expect(employedDays('2026-02', '2025-01-01', null)).toBe(28);
  });

  it('최저시급 미만 판단 — 그 달의 해 기준, 월급제는 월급 ÷ 209시간', () => {
    expect(isBelowMinimumWage({ payType: 'HOURLY', payAmount: 10_000 }, '2026-11')).toBe(true);
    expect(isBelowMinimumWage({ payType: 'HOURLY', payAmount: 10_320 }, '2026-11')).toBe(false);
    // 2025년 달은 2025년 최저시급(10,030원)으로
    expect(isBelowMinimumWage({ payType: 'HOURLY', payAmount: 10_100 }, '2025-12')).toBe(false);
    expect(isBelowMinimumWage({ payType: 'HOURLY', payAmount: 10_000 }, '2025-12')).toBe(true);
    // 월급제: 2,000,000 ÷ 209 = 9,569원 → 미달, 2,200,000 ÷ 209 = 10,526원 → 통과
    expect(isBelowMinimumWage({ payType: 'MONTHLY', payAmount: 2_000_000 }, '2026-11')).toBe(true);
    expect(isBelowMinimumWage({ payType: 'MONTHLY', payAmount: 2_200_000 }, '2026-11')).toBe(false);
  });

  it('연도별 최저시급 — 표에 없는 해는 가까운 앞 해 값', () => {
    expect(minimumWageFor('2024-05')).toBe(9_860);
    expect(minimumWageFor('2025-01')).toBe(10_030);
    expect(minimumWageFor(2026)).toBe(10_320);
    expect(minimumWageFor(2027)).toBe(10_320);
    expect(minimumWageFor(2020)).toBe(9_860);
  });
});
