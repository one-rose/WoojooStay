"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  changeRate,
  reportTotals,
  type PortfolioReport,
  type PortfolioReportProperty,
  type PropertyType,
  type SwitchPropertyAction,
} from "@/core";
import { cx, formatNumber } from "@/shared";
import { Icon, PageHead, PmButton, Stat, StatRow } from "../../components";
import "./report.css";

interface ReportScreenProps {
  report: PortfolioReport;
  /** 이번 달 "YYYY-MM" — 고를 수 있는 달의 끝 */
  thisMonth: string;
  /** 업장 이름을 누르면 그 업장 디지털매출장부로 */
  switchProperty: SwitchPropertyAction;
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
const replyRate = (p: Pick<PortfolioReportProperty, "reviews">) => pct(p.reviews.answered, p.reviews.count);

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

/** 엑셀에서 바로 열리는 CSV (한글이 깨지지 않게 BOM) */
function toCsv(r: PortfolioReport): string {
  const t = reportTotals(r);
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
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
    pct(t.reviews.answered, t.reviews.count),
    ...t.trend,
  ];
  return "﻿" + [head, ...rows, total].map((row) => row.map(cell).join(",")).join("\r\n");
}

/**
 * 업장 비교 리포트 (F8) — 한 달 동안 업장마다 매출 · 예약 · 객실 하루 매출 · 수수료 · 채널 · 별점 · 답글률,
 * 아래에 최근 6개월 업장별 매출. 엑셀(CSV)로 받을 수 있다.
 */
export function ReportScreen({ report, thisMonth, switchProperty }: ReportScreenProps) {
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
            <PmButton icon="download" onClick={download}>
              엑셀로 받기
            </PmButton>
          </>
        }
      />

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
          foot={`리뷰 ${formatNumber(t.reviews.count)}건, 답글 ${fmtPct(pct(t.reviews.answered, t.reviews.count))}`}
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
                <td className="is-num">{fmtPct(pct(t.reviews.answered, t.reviews.count))}</td>
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
