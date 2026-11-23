"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  changeRate,
  periodSales,
  PORTFOLIO_PERIODS,
  reportTotals,
  type MonthCosts,
  type PortfolioData,
  type PortfolioPeriod,
  type PortfolioReport,
  type PortfolioReportProperty,
  type PropertyType,
  type SwitchPropertyAction,
} from "@/core";
import { csvCell, cx, formatNumber, formatWon } from "@/shared";
import { Icon, PageHead, PmButton, Stat, StatRow } from "../../components";
import "./report.css";

interface ReportScreenProps {
  report: PortfolioReport;
  /** 이번 달 "YYYY-MM" — 고를 수 있는 달의 끝 */
  thisMonth: string;
  /** 업장 이름을 누르면 그 업장 디지털매출장부로 */
  switchProperty: SwitchPropertyAction;
  /** 보는 기간 — 어제 · 이번 주는 전체 현황 숫자로, 이번 달(기본)은 월 리포트 */
  period?: ReportPeriod;
  /** 고른 기간(어제·이번 주) 또는 오늘의 업장별 숫자 — 미답변 · 보고 요약 */
  snapshot?: PortfolioData;
}

export type ReportPeriod = Exclude<PortfolioPeriod, "today"> | "month";
const REPORT_PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: "yesterday", label: "어제" },
  { key: "week", label: "이번 주" },
  { key: "month", label: "월별" },
];
const won = formatWon;
const signed = (rate: number | null) =>
  rate === null ? "" : ` (${rate > 0 ? "+" : rate < 0 ? "−" : ""}${Math.abs(rate).toFixed(1)}%)`;
const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;

/** 카톡에 붙여 넣을 보고 요약 — 업장별 매출 · 앞 기간 대비 · 미답변 */
function summaryText(
  title: string,
  range: string,
  prevLabel: string,
  rows: readonly { name: string; sales: number; prev: number | null; unanswered: number }[],
): string {
  const total = rows.reduce((s, r) => s + r.sales, 0);
  const prevTotal = rows.every((r) => r.prev !== null) ? rows.reduce((s, r) => s + (r.prev ?? 0), 0) : null;
  const unanswered = rows.reduce((s, r) => s + r.unanswered, 0);
  const lines = [
    `[우주스테이] ${title} 보고 (${range}, 입실일 기준)`,
    `합계 매출 ${won(total)}${prevTotal === null ? "" : signed(changeRate(total, prevTotal))}, 답글 기다리는 리뷰 ${unanswered}건`,
    ...[...rows]
      .sort((a, b) => b.sales - a.sales)
      .map(
        (r) =>
          `- ${r.name}: ${won(r.sales)}${r.prev === null ? "" : signed(changeRate(r.sales, r.prev))}, 미답변 ${r.unanswered}건`,
      ),
    prevTotal === null ? "" : `괄호 안은 ${prevLabel} 대비예요.`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** 보고 요약 복사 버튼 */
function CopySummary({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <PmButton
      icon={done ? "check" : "copy"}
      iconSwap
      onClick={() =>
        void navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setDone(true);
            window.setTimeout(() => setDone(false), 2500);
          })
          .catch(() => undefined)
      }
    >
      {done ? "복사했어요" : "보고 요약 복사"}
    </PmButton>
  );
}

/** 지출 + 인건비 칸 — 매출 대비 비율, 급여가 계산 중이면 표시 */
function CostCell({ costs }: { costs?: MonthCosts }) {
  if (!costs) return <span className="rp-muted">–</span>;
  const total = costs.expenses + costs.payroll;
  return (
    <span className="rp-cost">
      <span className="num">{total > 0 ? formatNumber(total) : "0"}</span>
      <small>
        {costs.costRatio === null ? "매출 없음" : `매출의 ${(costs.costRatio * 100).toFixed(1)}%`}
        {costs.payrollStatus === "DRAFT" && ", 급여 계산 중"}
      </small>
    </span>
  );
}

const TYPE_LABEL: Record<PropertyType, string> = {
  hotel: "호텔",
  motel: "모텔",
  pension: "펜션",
  guesthouse: "게스트하우스",
};

/** 고를 수 있는 달 — 이번 달부터 1년 */
const MONTH_CHOICES = 12;

type SortKey = "sales" | "change" | "share" | "bookings" | "perRoom" | "fee" | "rating" | "replied" | "name";

const addMonth = (month: string, n: number) => {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const monthLabel = (m: string) => `${m.slice(0, 4)}년 ${Number(m.slice(5, 7))}월`;
const shortMonth = (m: string) => `${Number(m.slice(5, 7))}월`;
/** 만 원 단위 (월별 표) */
const man = (won: number) => formatNumber(Math.round(won / 10_000));
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);
/** 화면용 퍼센트 — 소수 첫째 자리까지 맞춰서 (9.0% · 22.2%) */
const fmtPct = (v: number | null) => (v === null ? "–" : `${v.toFixed(1)}%`);
const feeRate = (p: Pick<PortfolioReportProperty, "commission" | "sales">) => pct(p.commission, p.sales);
/** 답글률 — 채널에 이미 답글이 있던 리뷰는 분모에서 뺀다 (replyBase) */
const replyRate = (p: Pick<PortfolioReportProperty, "reviews">) =>
  pct(p.reviews.answered, p.reviews.replyBase ?? p.reviews.count);

function sortValue(p: PortfolioReportProperty, key: SortKey, total: number): number | string {
  switch (key) {
    case "sales":
    case "share":
      return p.sales;
    case "change":
      return changeRate(p.sales, p.prevSales) ?? -Infinity;
    case "bookings":
      return p.bookings;
    case "perRoom":
      return p.perRoomDay;
    case "fee":
      return feeRate(p) ?? -Infinity;
    case "rating":
      return p.reviews.avgRating ?? -Infinity;
    case "replied":
      return replyRate(p) ?? -Infinity;
    case "name":
      return p.name;
  }
  return total;
}

function Rate({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="rp-muted">–</span>;
  const abs = Math.abs(rate).toFixed(1);
  return (
    <span className={cx("num", rate > 0 && "rp-up", rate < 0 && "rp-down")}>
      {rate > 0 ? `+${abs}%` : rate < 0 ? `−${abs}%` : "0.0%"}
    </span>
  );
}

const sumOf = (r: PortfolioReport, f: (p: PortfolioReportProperty) => number) =>
  r.properties.reduce((s, p) => s + f(p), 0);

/** 엑셀에서 바로 열리는 CSV (한글이 깨지지 않게 BOM) */
function toCsv(r: PortfolioReport): string {
  const t = reportTotals(r);
  const head = [
    "업장",
    "종류",
    "객실",
    "매출(원)",
    r.partial ? "지난달 같은 날까지(원)" : "지난달(원)",
    "전월비(%)",
    "예약(건)",
    "객실 하루 매출(원)",
    "수수료(원)",
    "수수료율(%)",
    "1위 채널",
    "1위 채널 비중(%)",
    "리뷰(건)",
    "평균 별점",
    "답글률(%)",
    "지출(원)",
    "인건비(원)",
    "매출 대비 비용(%)",
    ...r.months.map((m) => `${m} 매출(원)`),
  ];
  const rows = r.properties.map((p) => [
    p.name,
    TYPE_LABEL[p.type],
    p.rooms,
    p.sales,
    p.prevSales,
    changeRate(p.sales, p.prevSales),
    p.bookings,
    p.perRoomDay,
    p.commission,
    feeRate(p),
    p.channels[0]?.name ?? "",
    p.channels[0] ? pct(p.channels[0].sales, p.sales) : null,
    p.reviews.count,
    p.reviews.avgRating,
    replyRate(p),
    p.costs?.expenses ?? null,
    p.costs?.payroll ?? null,
    p.costs?.costRatio == null ? null : Math.round(p.costs.costRatio * 1000) / 10,
    ...p.trend,
  ]);
  const total = [
    "합계",
    "",
    t.rooms,
    t.sales,
    t.prevSales,
    changeRate(t.sales, t.prevSales),
    t.bookings,
    t.perRoomDay,
    t.commission,
    pct(t.commission, t.sales),
    "",
    null,
    t.reviews.count,
    t.reviews.avgRating,
    pct(t.reviews.answered, t.reviews.replyBase),
    sumOf(r, (p) => p.costs?.expenses ?? 0),
    sumOf(r, (p) => p.costs?.payroll ?? 0),
    pct(t.costs, t.sales),
    ...t.trend,
  ];
  return "﻿" + [head, ...rows, total].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/**
 * 업장 비교 리포트 (F8) — 한 달 동안 업장마다 매출 · 예약 · 객실 하루 매출 · 수수료 · 채널 · 별점 · 답글률,
 * 아래에 최근 6개월 업장별 매출. 엑셀(CSV)로 받을 수 있다.
 */
export function ReportScreen({ report, thisMonth, switchProperty, period = "month", snapshot }: ReportScreenProps) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "sales", desc: true });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [monthPending, startMonth] = useTransition();
  const t = reportTotals(report);
  const maxShare = Math.max(...report.properties.map((p) => p.sales), 1);

  const rows = useMemo(() => {
    const list = [...report.properties];
    list.sort((a, b) => {
      const va = sortValue(a, sort.key, t.sales);
      const vb = sortValue(b, sort.key, t.sales);
      const c = typeof va === "string" ? va.localeCompare(vb as string, "ko") : (va as number) - (vb as number);
      return sort.desc ? -c : c;
    });
    return list;
  }, [report.properties, sort, t.sales]);

  const head = (key: SortKey, label: string, num = true) => {
    const on = sort.key === key;
    return (
      <th
        scope="col"
        className={cx(num && "is-num")}
        aria-sort={on ? (sort.desc ? "descending" : "ascending") : "none"}
      >
        <button
          type="button"
          className={cx("rp-sort", on && "is-on")}
          onClick={() => setSort({ key, desc: on ? !sort.desc : key !== "name" })}
        >
          {label}
          {on && <Icon name="chevronDown" size={13} className={cx("rp-sort__caret", !sort.desc && "is-up")} />}
        </button>
      </th>
    );
  };

  const openLedger = (p: PortfolioReportProperty) => {
    if (isPending) return;
    setError("");
    setPendingId(p.id);
    startTransition(async () => {
      const r = await switchProperty(p.id, `/app/ledger?month=${report.month}`);
      if (r && !r.ok) {
        setError(r.message);
        setPendingId(null);
      }
    });
  };

  const download = () => {
    const blob = new Blob([toCsv(report)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `woojoostay-report-${report.month}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    // 바로 지우면 일부 브라우저에서 파일 이름이 사라진다
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const months = Array.from({ length: MONTH_CHOICES }, (_, i) => addMonth(thisMonth, -i));
  const topChannel = (p: PortfolioReportProperty) => p.channels[0];
  const hasCosts = report.properties.some((p) => p.costs);
  const unansweredOf = (id: string) => snapshot?.properties.find((x) => x.id === id)?.reviews.unanswered ?? 0;

  const periodSwitch = (
    <div className="rp-period" role="group" aria-label="보는 기간">
      {REPORT_PERIODS.map((x) => (
        <button
          key={x.key}
          type="button"
          className={cx("rp-period__btn", x.key === period && "is-on")}
          aria-pressed={x.key === period}
          disabled={monthPending}
          onClick={() =>
            startMonth(() =>
              router.push(x.key === "month" ? "/app/overview/report" : `/app/overview/report?period=${x.key}`),
            )
          }
        >
          {x.label}
        </button>
      ))}
    </div>
  );

  // 어제 · 이번 주 — 전체 현황과 같은 숫자(입실일 기준)로 짧게
  if (period !== "month" && snapshot) {
    const view = PORTFOLIO_PERIODS.find((x) => x.key === period)!;
    const range = snapshot.period
      ? snapshot.period.from === snapshot.period.to
        ? md(snapshot.period.from)
        : `${md(snapshot.period.from)}~${md(snapshot.period.to)}`
      : md(snapshot.date);
    const prevName = period === "week" ? "지난주 같은 날까지" : "그제";
    const list = snapshot.properties.map((p) => {
      const ps = periodSales(p, period);
      return { p, ps, rate: ps.prevSales === null ? null : changeRate(ps.sales, ps.prevSales) };
    });
    const total = list.reduce((s, r) => s + r.ps.sales, 0);
    const prevTotal = list.reduce((s, r) => s + (r.ps.prevSales ?? 0), 0);
    const text = summaryText(
      `${view.label}`,
      range,
      prevName,
      list.map((r) => ({
        name: r.p.name,
        sales: r.ps.sales,
        prev: r.ps.prevSales,
        unanswered: r.p.reviews.unanswered,
      })),
    );
    return (
      <div className={cx("rp", monthPending && "is-busy")}>
        <PageHead
          title="업장 비교"
          desc={`업장 ${list.length}곳의 ${view.label}(${range}) 매출을 ${prevName}와 비교해요. 매출은 입실일 기준이에요.`}
          actions={<CopySummary text={text} />}
        />
        {periodSwitch}
        <StatRow cols={3} label={`${view.label} 합계`}>
          <Stat
            icon="money_bag"
            label={`${view.label} 입실 매출`}
            prefix="₩"
            value={formatNumber(total)}
            delta={{ rate: changeRate(total, prevTotal), label: `${prevName}보다` }}
          />
          <Stat label="예약" value={formatNumber(list.reduce((s, r) => s + r.ps.bookings, 0))} suffix="건" />
          <Stat
            icon="speech_balloon"
            label="답글 기다리는 리뷰"
            value={formatNumber(snapshot.totals.reviews.unanswered)}
            suffix="건"
            foot={`별점 3점 이하 ${snapshot.totals.reviews.lowRated}건`}
          />
        </StatRow>
        <section className="rp-panel" aria-labelledby="rp-period-title">
          <header className="rp-panel__head">
            <h2 id="rp-period-title">업장별 {view.label}</h2>
            <span>매출 많은 순</span>
          </header>
          <div className="pm-table-wrap rp-table-wrap">
            <table className="pm-table rp-table">
              <thead>
                <tr>
                  <th scope="col">업장</th>
                  <th scope="col" className="is-num">
                    매출
                  </th>
                  <th scope="col" className="is-num">
                    {period === "week" ? "지난주비" : "전일비"}
                  </th>
                  <th scope="col" className="is-num">
                    예약
                  </th>
                  <th scope="col" className="is-num">
                    미답변(낮은 별점)
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...list]
                  .sort((a, b) => b.ps.sales - a.ps.sales)
                  .map(({ p, ps, rate }) => (
                    <tr key={p.id}>
                      <th scope="row">{p.name}</th>
                      <td className="is-num">{formatNumber(ps.sales)}</td>
                      <td className="is-num">
                        <Rate rate={rate} />
                      </td>
                      <td className="is-num">{formatNumber(ps.bookings)}</td>
                      <td className="is-num">
                        {p.reviews.unanswered}
                        {p.reviews.lowRated > 0 && <span className="rp-low"> ({p.reviews.lowRated})</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">합계</th>
                  <td className="is-num">{formatNumber(total)}</td>
                  <td className="is-num">
                    <Rate rate={changeRate(total, prevTotal)} />
                  </td>
                  <td className="is-num">{formatNumber(list.reduce((s, r) => s + r.ps.bookings, 0))}</td>
                  <td className="is-num">{snapshot.totals.reviews.unanswered}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <details className="rp-summary">
            <summary>복사될 보고 요약 보기</summary>
            <pre>{text}</pre>
          </details>
        </section>
      </div>
    );
  }

  const monthText = summaryText(
    monthLabel(report.month),
    report.partial ? `${Number(report.month.slice(5))}.1~오늘` : monthLabel(report.month),
    report.partial ? "지난달 같은 날까지" : "지난달",
    report.properties.map((p) => ({ name: p.name, sales: p.sales, prev: p.prevSales, unanswered: unansweredOf(p.id) })),
  );

  return (
    <div className={cx("rp", (isPending || monthPending) && "is-busy")}>
      <PageHead
        title="업장 비교"
        desc={
          report.partial
            ? `업장 ${report.properties.length}곳의 이번 달(오늘까지 ${report.days}일)을 같은 기준으로 비교해요. 전월비는 지난달 같은 날까지와 비교해요.`
            : `업장 ${report.properties.length}곳의 ${monthLabel(report.month)}을 같은 기준으로 비교해요.`
        }
        actions={
          <>
            <label className="rp-month">
              <span className="pm-sr">월</span>
              <select
                className="pm-input"
                value={report.month}
                onChange={(e) =>
                  startMonth(() => router.push(`/app/overview/report?month=${encodeURIComponent(e.target.value)}`))
                }
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                    {m === thisMonth ? " (이번 달)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <CopySummary text={monthText} />
            <PmButton icon="download" onClick={download}>
              엑셀로 내려받기
            </PmButton>
          </>
        }
      />
      {periodSwitch}

      {error && (
        <p className="rp-error" role="alert">
          {error}
        </p>
      )}

      <StatRow label={`${monthLabel(report.month)} 합계`}>
        <Stat
          label="매출"
          prefix="₩"
          value={formatNumber(t.sales)}
          delta={{
            rate: changeRate(t.sales, t.prevSales),
            label: report.partial ? "지난달 같은 날보다" : "지난달보다",
          }}
        />
        <Stat label="예약" value={formatNumber(t.bookings)} suffix="건" foot={`객실 ${formatNumber(t.rooms)}실`} />
        <Stat
          label="객실 하루 매출"
          prefix="₩"
          value={formatNumber(t.perRoomDay)}
          foot={`수수료율 ${fmtPct(pct(t.commission, t.sales))}`}
        />
        <Stat
          label="평균 별점"
          value={t.reviews.avgRating?.toFixed(1) ?? "–"}
          foot={`리뷰 ${formatNumber(t.reviews.count)}건, 답글 ${fmtPct(pct(t.reviews.answered, t.reviews.replyBase))}`}
        />
      </StatRow>

      <section className="rp-panel" aria-labelledby="rp-compare">
        <header className="rp-panel__head">
          <h2 id="rp-compare">업장별 비교</h2>
          <span>업장 이름을 누르면 그 업장 매출장부로 가요</span>
        </header>
        <div className="pm-table-wrap rp-table-wrap">
          <table className="pm-table rp-table">
            <thead>
              <tr>
                {head("name", "업장", false)}
                {head("sales", "매출")}
                {head("change", "전월비")}
                {head("share", "매출 비중", false)}
                {head("bookings", "예약")}
                {head("perRoom", "객실 하루 매출")}
                {head("fee", "수수료율")}
                <th scope="col">1위 채널</th>
                {head("rating", "별점")}
                {head("replied", "답글률")}
                {hasCosts && (
                  <th scope="col" className="is-num">
                    지출·인건비
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const top = topChannel(p);
                return (
                  <tr key={p.id} className={cx(pendingId === p.id && "is-pending")}>
                    <th scope="row" className="rp-name">
                      <button type="button" onClick={() => openLedger(p)}>
                        <strong>{p.name}</strong>
                        <small>{pendingId === p.id ? "여는 중이에요" : `${TYPE_LABEL[p.type]} ${p.rooms}실`}</small>
                      </button>
                    </th>
                    <td className="is-num">{formatNumber(p.sales)}</td>
                    <td className="is-num">
                      <Rate rate={changeRate(p.sales, p.prevSales)} />
                    </td>
                    <td className="rp-share">
                      <span className="rp-share__track" aria-hidden>
                        <span className="rp-share__fill" style={{ width: `${(p.sales / maxShare) * 100}%` }} />
                      </span>
                      <span className="num">{fmtPct(pct(p.sales, t.sales) ?? 0)}</span>
                    </td>
                    <td className="is-num">{formatNumber(p.bookings)}</td>
                    <td className="is-num">{formatNumber(p.perRoomDay)}</td>
                    <td className="is-num">{fmtPct(feeRate(p))}</td>
                    <td>
                      {top ? (
                        <span className="rp-channel">
                          {top.name} <span className="num rp-muted">{fmtPct(pct(top.sales, p.sales))}</span>
                        </span>
                      ) : (
                        <span className="rp-muted">채널 없음</span>
                      )}
                    </td>
                    <td className="is-num">
                      {p.reviews.avgRating === null ? (
                        <span className="rp-muted">–</span>
                      ) : (
                        <>
                          <span className={cx(p.reviews.avgRating < 4 && "rp-low")}>
                            {p.reviews.avgRating.toFixed(1)}
                          </span>{" "}
                          <span className="rp-muted">({p.reviews.count})</span>
                        </>
                      )}
                    </td>
                    <td className="is-num">
                      {replyRate(p) === null ? <span className="rp-muted">–</span> : fmtPct(replyRate(p))}
                    </td>
                    {hasCosts && (
                      <td className="is-num">
                        <CostCell costs={p.costs} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">합계</th>
                <td className="is-num">{formatNumber(t.sales)}</td>
                <td className="is-num">
                  <Rate rate={changeRate(t.sales, t.prevSales)} />
                </td>
                <td />
                <td className="is-num">{formatNumber(t.bookings)}</td>
                <td className="is-num">{formatNumber(t.perRoomDay)}</td>
                <td className="is-num">{fmtPct(pct(t.commission, t.sales))}</td>
                <td />
                <td className="is-num">{t.reviews.avgRating?.toFixed(1) ?? "–"}</td>
                <td className="is-num">{fmtPct(pct(t.reviews.answered, t.reviews.replyBase))}</td>
                {hasCosts && (
                  <td className="is-num">
                    {formatNumber(t.costs)}
                    <small className="rp-muted"> {fmtPct(pct(t.costs, t.sales))}</small>
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="rp-panel" aria-labelledby="rp-trend">
        <header className="rp-panel__head">
          <h2 id="rp-trend">월별 매출</h2>
          <span>단위 만 원{report.partial ? ", 이번 달은 오늘까지" : ""}</span>
        </header>
        <div className="pm-table-wrap rp-table-wrap">
          <table className="pm-table rp-table rp-trend">
            <thead>
              <tr>
                <th scope="col">업장</th>
                {report.months.map((m) => (
                  <th key={m} scope="col" className="is-num">
                    {shortMonth(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const peak = Math.max(...p.trend);
                return (
                  <tr key={p.id}>
                    <th scope="row">{p.name}</th>
                    {p.trend.map((v, i) => (
                      <td
                        key={report.months[i]}
                        className={cx("is-num", v > 0 && v === peak && "rp-peak", i === p.trend.length - 1 && "rp-now")}
                      >
                        {v > 0 ? man(v) : <span className="rp-muted">–</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">합계</th>
                {t.trend.map((v, i) => (
                  <td key={report.months[i]} className={cx("is-num", i === t.trend.length - 1 && "rp-now")}>
                    {man(v)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="rp-note">업장마다 6개월 중 가장 많이 번 달을 굵게 표시했어요.</p>
      </section>
    </div>
  );
}
