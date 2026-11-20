"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  changeRate,
  type ChannelConnection,
  type ChannelId,
  type LedgerActions,
  type LedgerChannelRow,
  type LedgerData,
} from "@/core";
import {
  addDays,
  csvCell,
  cx,
  daysBetween,
  formatNumber,
  formatWon,
  formatWonCompact,
  weekday,
  weekdayKo,
} from "@/shared";
import {
  Badge,
  Card,
  ChannelChip,
  Field,
  Icon,
  Modal,
  PageHead,
  PmButton,
  Stat,
  StatRow,
  TableWrap,
  Tabs,
} from "../../components";
import "./ledger.css";

type Tab = "month" | "calendar" | "price" | "mix";

const TABS = [
  { id: "month", label: "월 경영 현황" },
  { id: "calendar", label: "정산 캘린더" },
  { id: "price", label: "채널 가격 비교" },
  { id: "mix", label: "대실·숙박" },
] as const;

const won = formatWon;
const pct = (n: number) => `${(Math.round(n * 1000) / 10).toFixed(1)}%`;
/** 나누는 값이 0 이면 null (NaN · Infinity 를 화면에 내지 않는다) */
const ratio = (a: number, b: number): number | null => (b > 0 && Number.isFinite(a) ? a / b : null);
const pctOr = (r: number | null, empty = "-") => (r === null ? empty : pct(r));
/** "11.15 (토)" — 요일은 날짜에서 계산 */
const shortDate = (iso: string) => `${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))} (${weekdayKo(iso)})`;
const monthLabel = (m: string) => `${Number(m.slice(5))}월`;
const yearMonth = (m: string) => `${m.slice(0, 4)}년 ${monthLabel(m)}`;
const shiftMonth = (m: string, n: number) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
const daysIn = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)), 0)).getUTCDate();

interface LedgerScreenProps {
  data: LedgerData;
  channels: readonly ChannelConnection[];
  today: string;
  /** 실서버면 이전·다음 달로 이동 (?month=YYYY-MM). 예시 화면은 이번 달만 */
  navigable?: boolean;
  /** 실서버 화면 — 예시 경쟁 업소·AI 제안은 숨긴다 */
  live?: boolean;
  /** 광고비 직접 입력 (사장님·매니저) — 없으면 입력 버튼 없음 */
  actions?: LedgerActions;
}

/** 채널별 실적을 CSV(엑셀에서 열림)로 내려받기 */
function downloadCsv(data: LedgerData, names: Record<ChannelId, string>) {
  const rows = [
    ["채널", "예약(건)", "예약매출(원)", "수수료율(%)", "수수료(원)", "광고비(원)"],
    ...data.channels.map((c) => [
      names[c.channel] ?? c.channel,
      c.bookings,
      c.sales,
      Math.round(c.feeRate * 1000) / 10,
      Math.round(c.sales * c.feeRate),
      c.adSpend,
    ]),
    ["합계", data.channels.reduce((s, c) => s + c.bookings, 0), data.sales, "", data.fees, data.adSpend],
  ];
  // 엑셀이 한글을 바로 읽도록 BOM 을 붙인다
  const blob = new Blob(["\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `woojoo-ledger-${data.month}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LedgerScreen({ data, channels, today, navigable = false, live = false, actions }: LedgerScreenProps) {
  const [tab, setTab] = useState<Tab>("month");
  const names = Object.fromEntries(channels.map((c) => [c.channel, c.name])) as Record<ChannelId, string>;

  return (
    <div className="lg">
      <PageHead
        title="디지털매출장부"
        desc="채널마다 흩어진 예약·수수료·광고비·정산을 한 장부로 모았어요."
        actions={
          <PmButton icon="download" onClick={() => downloadCsv(data, names)} disabled={data.channels.length === 0}>
            엑셀로 내려받기
          </PmButton>
        }
      />
      <Tabs items={TABS} value={tab} onChange={setTab} label="매출장부 보기" />
      {tab === "month" && (
        <MonthView data={data} names={names} thisMonth={today.slice(0, 7)} navigable={navigable} actions={actions} />
      )}
      {tab === "calendar" && <CalendarView data={data} names={names} today={today} />}
      {tab === "price" && <PriceView data={data} names={names} live={live} />}
      {tab === "mix" && <MixView data={data} />}
    </div>
  );
}

type ViewProps = { data: LedgerData; names: Record<ChannelId, string> };

/* F2-01 월 경영 대시보드 + F2-02 추이 */
function MonthView({
  data,
  names,
  thisMonth,
  navigable,
  actions,
}: ViewProps & { thisMonth: string; navigable: boolean; actions?: LedgerActions }) {
  const prev = shiftMonth(data.month, -1);
  const next = shiftMonth(data.month, 1);
  const canNext = navigable && next <= thisMonth;
  // 진행 중인 달: 매출은 오늘 체크인까지(확정), 비교도 지난달 같은 날까지 — 내일~말일 예약은 따로 한 줄
  const partial = data.partial ?? false;
  const upcoming = data.upcoming;
  const rate = changeRate(data.sales, partial ? (data.prevSalesToDate ?? data.prevSales) : data.prevSales);
  const [adFor, setAdFor] = useState<LedgerChannelRow | null>(null);
  const W = 640;
  const H = 180;
  const max = Math.max(1, ...data.trend.map((t) => t.sales)) * 1.1;
  const step = data.trend.length > 1 ? W / (data.trend.length - 1) : 0;
  const hasTrend = data.trend.some((t) => t.sales > 0);
  const kept = data.sales - data.fees - data.adSpend;
  const points = data.trend.map((t, i) => [Math.round(i * step), Math.round(H - (t.sales / max) * H)] as const);
  // 곧은 선 — 매끈한 곡선은 없는 오르내림을 만들어 낸다 (D-14)
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");

  return (
    <>
      <div className="lg-month">
        {navigable ? (
          <Link className="lg-month__nav" aria-label="이전 달" href={`?month=${prev}`} scroll={false}>
            <Icon name="chevronLeft" size={16} />
          </Link>
        ) : (
          <button type="button" className="lg-month__nav" aria-label="이전 달" disabled>
            <Icon name="chevronLeft" size={16} />
          </button>
        )}
        <strong>{yearMonth(data.month)}</strong>
        {canNext ? (
          <Link className="lg-month__nav" aria-label="다음 달" href={`?month=${next}`} scroll={false}>
            <Icon name="chevron" size={16} />
          </Link>
        ) : (
          <button type="button" className="lg-month__nav" aria-label="다음 달" disabled>
            <Icon name="chevron" size={16} />
          </button>
        )}
        <span className="lg-month__basis">매출 기준: 투숙일</span>
      </div>

      <StatRow cols={4}>
        <Stat
          label={partial ? "확정 매출" : "총 예약매출"}
          prefix="₩"
          value={formatNumber(data.sales)}
          delta={{ rate, label: partial ? "지난달 같은 날보다" : "전월보다" }}
          foot={
            partial
              ? upcoming && upcoming.sales > 0
                ? `말일까지 예약 ${won(upcoming.sales)} 더 있어요`
                : "오늘 체크인까지"
              : undefined
          }
        />
        <Stat
          label="광고비"
          prefix="₩"
          value={formatNumber(data.adSpend)}
          foot={`매출 대비 ${pctOr(ratio(data.adSpend, data.sales))}`}
        />
        <Stat
          label="플랫폼 수수료"
          prefix="₩"
          value={formatNumber(data.fees)}
          foot={`평균 수수료율 ${pctOr(ratio(data.fees, data.sales))}`}
        />
        <Stat
          label="14일 안 정산 예정"
          prefix="₩"
          value={formatNumber(data.settleSoon)}
          foot="정산 캘린더에서 날짜별 확인"
        />
      </StatRow>

      <div className="lg-grid">
        <Card title="예약매출 추이" meta="최근 10개월">
          {!hasTrend ? (
            <p className="lg-empty">채널을 연결하면 월별 예약매출이 여기에 쌓여요.</p>
          ) : (
            <svg
              viewBox={`-20 -16 ${W + 40} ${H + 44}`}
              className="lg-trend"
              role="img"
              aria-label="월별 예약매출 추이"
            >
              {[0.25, 0.5, 0.75, 1].map((g) => (
                <line key={g} x1={0} x2={W} y1={H - g * H} y2={H - g * H} className="lg-trend__grid" />
              ))}
              <path d={line} className="lg-trend__line" />
              {points.map(([x, y], i) => {
                const last = i === points.length - 1;
                // 휴대폰에서는 글자가 겹치지 않게 홀수 달(끝에서부터 하나 건너)만
                const odd = (points.length - 1 - i) % 2 === 1;
                return (
                  <g key={data.trend[i].month} className={cx(odd && "is-odd", last && "is-last")}>
                    <circle cx={x} cy={y} r={last ? 4 : 2.5} className={last ? "lg-trend__dot" : "lg-trend__pt"} />
                    <text x={x} y={H + 24} className="lg-trend__x">
                      {monthLabel(data.trend[i].month)}
                    </text>
                    {data.trend[i].sales > 0 && (
                      <text x={x} y={y - 10} className="lg-trend__val num">
                        {formatWonCompact(data.trend[i].sales)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </Card>
        <Card title="비용 구조" meta="매출 대비">
          {data.sales <= 0 ? (
            <p className="lg-empty">이 달 예약매출이 없어 비용 구조를 계산할 수 없어요.</p>
          ) : (
            <ul className="lg-cost">
              {[
                { label: "플랫폼 수수료", value: data.fees },
                { label: "광고비", value: data.adSpend },
                { label: "남는 매출", value: kept },
              ].map((c, i) => {
                const r = ratio(Math.max(0, c.value), data.sales) ?? 0;
                return (
                  <li key={c.label}>
                    <span className="lg-cost__head">
                      <span>{c.label}</span>
                      <strong className="num">{won(c.value)}</strong>
                    </span>
                    <span className="lg-cost__track">
                      <span className={cx("lg-cost__fill", `is-${i}`)} style={{ width: pct(Math.min(1, r)) }} />
                    </span>
                    <small className="num">{pct(r)}</small>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="채널별 실적" meta={partial ? "오늘 체크인까지" : yearMonth(data.month)} flush>
        <TableWrap>
          <table className="pm-table">
            <thead>
              <tr>
                <th>채널</th>
                <th className="is-num">예약</th>
                <th className="is-num">예약매출(원)</th>
                <th className="is-num">수수료율</th>
                <th className="is-num">수수료(원)</th>
                <th className="is-num">광고비(원)</th>
                <th className="is-num">광고 효율</th>
              </tr>
            </thead>
            <tbody>
              {data.channels.length === 0 && (
                <tr>
                  <td colSpan={7} className="is-muted lg-empty-row">
                    {data.month < thisMonth
                      ? "이 달 기록이 없어요."
                      : "이 달 채널 실적이 아직 없어요. 채널을 연결하면 예약·수수료가 자동으로 쌓여요."}
                  </td>
                </tr>
              )}
              {data.channels.map((c) => (
                <tr key={c.channel}>
                  <td>
                    <ChannelChip channel={c.channel} name={names[c.channel]} />
                  </td>
                  <td className="is-num">{c.bookings}건</td>
                  <td className="is-num">{formatNumber(c.sales)}</td>
                  <td className="is-num">{pct(c.feeRate)}</td>
                  <td className="is-num">{formatNumber(Math.round(c.sales * c.feeRate))}</td>
                  <td className="is-num">
                    {actions ? (
                      <button
                        type="button"
                        className="lg-ad"
                        aria-label={`${names[c.channel] ?? c.channel} 광고비 입력`}
                        onClick={() => setAdFor(c)}
                      >
                        {c.adSpend ? formatNumber(c.adSpend) : "입력"}
                        <Icon name="edit" size={13} />
                      </button>
                    ) : c.adSpend ? (
                      formatNumber(c.adSpend)
                    ) : (
                      <span className="is-muted">-</span>
                    )}
                  </td>
                  <td className="is-num">
                    {c.adSpend > 0 ? (
                      <strong>{(c.sales / c.adSpend).toFixed(1)}배</strong>
                    ) : (
                      <span className="is-muted">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {data.channels.length > 0 && (
              <tfoot>
                <tr>
                  <td>합계</td>
                  <td className="is-num">{data.channels.reduce((s, c) => s + c.bookings, 0)}건</td>
                  <td className="is-num">{formatNumber(data.sales)}</td>
                  <td className="is-num">{pctOr(ratio(data.fees, data.sales))}</td>
                  <td className="is-num">{formatNumber(data.fees)}</td>
                  <td className="is-num">{formatNumber(data.adSpend)}</td>
                  <td className="is-num">{data.adSpend > 0 ? `${(data.sales / data.adSpend).toFixed(1)}배` : "-"}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </TableWrap>
        <p className="lg-foot">
          광고 효율 = 예약매출 ÷ 광고비. 광고비는 채널 광고 관리자에서 가져오거나 직접 입력해요.
          {partial && upcoming && upcoming.bookings > 0 && (
            <> 내일부터 말일까지 체크인 예정 {formatNumber(upcoming.bookings)}건은 투숙일이 지나면 더해져요.</>
          )}
        </p>
      </Card>
      {adFor && actions && (
        <AdSpendDialog
          channel={names[adFor.channel] ?? adFor.channel}
          month={data.month}
          current={adFor.adSpend}
          onClose={() => setAdFor(null)}
          save={(amount) => actions.setAdSpend(adFor.channel, data.month, amount)}
        />
      )}
    </>
  );
}

/** 채널 광고비 직접 입력 — 같은 채널·달은 덮어쓴다 */
function AdSpendDialog({
  channel,
  month,
  current,
  onClose,
  save,
}: {
  channel: string;
  month: string;
  current: number;
  onClose: () => void;
  save: (amount: number) => ReturnType<LedgerActions["setAdSpend"]>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current ? formatNumber(current) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const digits = value.replace(/\D/g, "");
  const amount = Number(digits);
  const valid = digits !== "" && amount <= 1_000_000_000;
  const submit = () =>
    start(async () => {
      setError(null);
      const r = await save(amount);
      if (!r.ok) return setError(r.message);
      onClose();
      router.refresh();
    });
  return (
    <Modal
      title={`${channel} 광고비`}
      desc={`${yearMonth(month)}에 ${channel}에서 쓴 광고비를 넣어 주세요. 광고 효율 계산에 바로 반영돼요.`}
      onClose={onClose}
      footer={
        <>
          <PmButton variant="ghost" onClick={onClose}>
            취소
          </PmButton>
          <PmButton variant="primary" disabled={pending || !valid} onClick={submit}>
            {pending ? "저장 중…" : "저장"}
          </PmButton>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !pending) submit();
        }}
      >
        <Field label="광고비 (원)" hint="같은 달에 다시 넣으면 새 금액으로 바뀌어요.">
          <input
            className="pm-input num"
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "");
              setValue(d ? formatNumber(Number(d)) : "");
            }}
          />
        </Field>
        {error && (
          <p className="pm-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/* F2-03 정산 캘린더 */
function CalendarView({ data, names, today }: ViewProps & { today: string }) {
  const first = `${data.calendar.month}-01`;
  const lead = (weekday(first) + 6) % 7; // 월요일 시작
  const days = Array.from({ length: daysIn(data.calendar.month) }, (_, i) => addDays(first, i));
  const byDate = Object.fromEntries(data.calendar.days.map((d) => [d.date, d.items]));
  const soon = data.calendar.days.filter((d) => {
    const n = daysBetween(today, d.date);
    return n >= 0 && n <= 7;
  });
  const soonTotal = soon.reduce((s, d) => s + d.items.reduce((a, i) => a + i.amount, 0), 0);
  const monthTotal = data.calendar.days.reduce((s, d) => s + d.items.reduce((a, i) => a + i.amount, 0), 0);

  return (
    <div className="lg-cal-wrap">
      <Card
        title={yearMonth(data.calendar.month)}
        meta={<span className="num">합계 {won(monthTotal)}</span>}
        className="lg-cal-card"
      >
        <div className="lg-cal" role="grid" aria-label={`${monthLabel(data.calendar.month)} 정산 캘린더`}>
          {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
            <span key={d} className="lg-cal__dow">
              {d}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {days.map((date) => {
            const items = byDate[date] ?? [];
            const n = daysBetween(today, date);
            return (
              <div
                key={date}
                className={cx(
                  "lg-cal__day",
                  date === today && "is-today",
                  n < 0 && "is-past",
                  n >= 0 && n <= 7 && "is-soon",
                )}
              >
                <span className="lg-cal__num num">{Number(date.slice(8))}</span>
                {items.map((it) => (
                  <span key={it.channel} className={cx("lg-cal__item", it.done && "is-done")}>
                    <ChannelChip channel={it.channel} name={names[it.channel]} variant="icon" />
                    <span className="num">{formatWonCompact(it.amount)}</span>
                    {it.done && <Icon name="check" size={12} />}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="7일 안 입금 예정" className="lg-soon">
        <p className="lg-soon__total num">{won(soonTotal)}</p>
        {soon.length === 0 && <p className="lg-empty">7일 안에 들어올 정산이 없어요.</p>}
        <ul>
          {soon.flatMap((d) =>
            d.items.map((it) => (
              <li key={d.date + it.channel}>
                <span className="lg-soon__date">
                  <span className="num">
                    {Number(d.date.slice(5, 7))}.{Number(d.date.slice(8))}
                  </span>
                  <small className="num">D-{daysBetween(today, d.date)}</small>
                </span>
                <ChannelChip channel={it.channel} name={names[it.channel]} />
                <strong className="num">{won(it.amount)}</strong>
              </li>
            )),
          )}
        </ul>
        <div className="lg-soon__cta">
          <p>
            정산 전에 미리 받고 싶다면 <strong>매출선정산</strong>에서 신청할 수 있어요.
          </p>
          <span className="lg-soon__soon">준비 중</span>
        </div>
      </Card>
    </div>
  );
}

/* F2-05 채널 가격 노출·경쟁력 비교 */
const prices = (p: Partial<Record<ChannelId, number>>) =>
  Object.values(p).filter((v): v is number => typeof v === "number" && v > 0);

function PriceView({ data, names, live }: ViewProps & { live: boolean }) {
  const pc = data.priceCompare;
  const rooms = pc.rooms ?? [];
  const chans = [...new Set(rooms.flatMap((r) => Object.keys(r.prices)))] as ChannelId[];
  /** 같은 객실 유형 이름의 우리 최저가 (공백·대소문자 무시) */
  const key = (t: string) => t.replace(/\s+/g, "").toLowerCase();
  const ourMinFor = (roomType: string) => {
    const r = rooms.find((x) => key(x.roomType) === key(roomType));
    const v = r ? prices(r.prices) : [];
    return v.length ? Math.min(...v) : null;
  };
  const competitors = live ? [] : (pc.competitors ?? []);
  return (
    <>
      <Card title="채널별 판매가" meta={rooms.length ? `${shortDate(pc.date)} 기준` : undefined} flush>
        {rooms.length === 0 ? (
          <p className="lg-empty lg-empty--pad">
            채널을 연결하면 채널마다 고객에게 보이는 판매가를 모아 비교해 드려요.
          </p>
        ) : (
          <TableWrap>
            <table className="pm-table">
              <thead>
                <tr>
                  <th>객실</th>
                  {chans.map((c) => (
                    <th key={c} className="is-num">
                      {names[c] ?? c}
                    </th>
                  ))}
                  <th className="is-num">채널 간 차이</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => {
                  const vals = prices(r.prices);
                  const min = vals.length ? Math.min(...vals) : 0;
                  const max = vals.length ? Math.max(...vals) : 0;
                  const gap = vals.length > 1 ? ratio(max - min, min) : null;
                  return (
                    <tr key={r.roomType}>
                      <td>
                        <strong>{r.roomType}</strong>
                      </td>
                      {chans.map((c) => {
                        const v = r.prices[c];
                        return (
                          <td
                            key={c}
                            className={cx(
                              "is-num",
                              vals.length > 1 && v === min && "lg-low",
                              vals.length > 1 && v === max && "lg-high",
                            )}
                          >
                            {v ? won(v) : <span className="is-muted">미판매</span>}
                          </td>
                        );
                      })}
                      <td className="is-num">
                        {gap === null ? (
                          <span className="is-muted">-</span>
                        ) : (
                          <Badge tone={gap > 0.08 ? "warn" : "neutral"}>{pct(gap)}</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
        {rooms.length > 0 && (
          <p className="lg-foot">
            고객에게 보이는 가격이에요. <span className="lg-low">초록</span>은 가장 싼 채널,{" "}
            <span className="lg-high">빨강</span>은 가장 비싼 채널. 차이가 8%를 넘으면 주의 표시를 해요.
          </p>
        )}
      </Card>
      <div className={live ? "lg-stack" : "lg-grid lg-grid--even"}>
        <Card title="주변 경쟁 업소" meta={competitors.length ? "같은 객실 유형" : undefined}>
          {competitors.length === 0 ? (
            <div className="lg-empty lg-empty--box">
              <Icon name="calendar" size={18} />
              <p>
                <strong>주변 업소 가격 수집 준비 중</strong>
                가까운 업소의 같은 객실 가격을 모아 우리 가격과 비교해 드릴 예정이에요.
              </p>
            </div>
          ) : (
            <ul className="lg-comp">
              {competitors.map((c) => {
                const ours = ourMinFor(c.roomType);
                return (
                  <li key={c.name + c.roomType}>
                    <span>
                      {c.name}
                      <small className="lg-comp__room">{c.roomType}</small>
                    </span>
                    <small>{c.distance}</small>
                    <strong className="num">{won(c.price)}</strong>
                    {ours === null ? (
                      <span className="lg-comp__none">같은 객실 없음</span>
                    ) : (
                      <span className={cx("lg-comp__vs", c.price < ours && "is-bad")}>
                        {c.price < ours ? `우리보다 ${won(ours - c.price)} 쌈` : "우리보다 비쌈"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        {!live && (
          <Card title="가격 조정 제안" meta="예시 화면">
            <div className="lg-suggest">
              <p>
                네이버가 다른 채널보다 <strong>5~7% 싸게</strong> 노출되고 있어요. 수수료가 가장 낮은 채널이라 그대로
                두면 직접 예약 유도에 유리하지만, 아고다와는 <strong>{won(13_000)}</strong> 차이가 나서 가격
                동등성(패리티) 문의가 올 수 있어요.
              </p>
            </div>
            <PmButton icon="rates" href="/app/rates">
              요금·재고에서 조정하기
            </PmButton>
          </Card>
        )}
      </div>
    </>
  );
}

/* F2-06 대실·숙박 매출 집계 */
function MixView({ data }: { data: LedgerData }) {
  const m = data.stayMix;
  const max = Math.max(...m.hourly.map((h) => h.count), 1);
  const turnover = ratio(m.dayuse.count + m.overnight.count, m.rooms);
  const daySales = m.dayuse.sales + m.overnight.sales;
  return (
    <>
      <StatRow cols={4}>
        <Stat label="오늘 대실" value={m.dayuse.count} suffix="건" foot={won(m.dayuse.sales)} />
        <Stat label="오늘 숙박" value={m.overnight.count} suffix="건" foot={won(m.overnight.sales)} />
        <Stat
          label="오늘 합계"
          prefix="₩"
          value={formatNumber(daySales)}
          foot={`대실 비중 ${pctOr(ratio(m.dayuse.sales, daySales))}`}
        />
        <Stat
          label="회전율"
          value={turnover === null ? "-" : turnover.toFixed(2)}
          suffix={turnover === null ? undefined : "회"}
          foot={m.rooms > 0 ? `객실 ${m.rooms}실 기준` : "객실 수를 등록하면 계산해요"}
        />
      </StatRow>
      <Card title="시간대별 대실 입실" meta={shortDate(m.date)}>
        <div className="lg-hours" role="img" aria-label="시간대별 대실 입실 수">
          {m.hourly.map((h) => (
            <div key={h.hour} className="lg-hours__col">
              <span className="lg-hours__n num">{h.count || ""}</span>
              <span className="lg-hours__bar" style={{ height: `${(h.count / max) * 100}%` }} />
              <span className="lg-hours__h num">{h.hour}시</span>
            </div>
          ))}
        </div>
        {m.dayuse.count === 0 && <p className="lg-empty">오늘 대실 입실이 아직 없어요.</p>}
        <p className="lg-foot">대실·숙박은 채널이 보내 주는 예약 유형으로 나눠요.</p>
      </Card>
    </>
  );
}
