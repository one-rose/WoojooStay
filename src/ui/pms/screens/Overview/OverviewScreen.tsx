"use client";

import { useMemo, useState, useTransition } from "react";
import {
  changeRate,
  topAlertRank,
  type PortfolioAlert,
  type PortfolioAlertKind,
  type PortfolioData,
  type PortfolioProperty,
  type PropertyType,
  type SwitchPropertyAction,
} from "@/core";
import { cx, formatLongDate, formatNumber } from "@/shared";
import { Badge, Icon, PageHead, PmButton, Stat, StatRow, type BadgeTone } from "../../components";
import "./overview.css";

interface OverviewScreenProps {
  data: PortfolioData;
  /** 업장을 바꾸고 그 업장 화면(next)으로 */
  switchProperty: SwitchPropertyAction;
}

const TYPE_LABEL: Record<PropertyType, string> = {
  hotel: "호텔",
  motel: "모텔",
  pension: "펜션",
  guesthouse: "게스트하우스",
};

/** 확인할 일 — 상태 글자 · 색 · 해결 버튼 */
const ALERT_VIEW: Record<PortfolioAlertKind, { label: string; tone: BadgeTone; action: string }> = {
  "channel-auth": { label: "연동 끊김", tone: "bad", action: "다시 연결" },
  "channel-error": { label: "수집 오류", tone: "bad", action: "연동 확인" },
  "payment-failed": { label: "결제 실패", tone: "bad", action: "카드 확인" },
  "low-rated": { label: "낮은 별점", tone: "warn", action: "리뷰 보기" },
  "stale-dirty": { label: "청소 지연", tone: "warn", action: "현장 업무" },
  "missing-clock-out": { label: "퇴근 누락", tone: "warn", action: "근무 기록" },
  "no-channel": { label: "채널 없음", tone: "neutral", action: "채널 연결" },
};

/** 확인할 업장은 처음에 이만큼만 (나머지는 펼쳐서) */
const ATTN_LIMIT = 5;

type SortKey = "today" | "change" | "month" | "reviews" | "settle" | "rooms" | "staff" | "attention" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "today", label: "오늘 매출" },
  { key: "attention", label: "급한 일" },
  { key: "change", label: "전일비" },
  { key: "month", label: "이번 달 매출" },
  { key: "reviews", label: "미답변 리뷰" },
  { key: "settle", label: "7일 안 정산" },
  { key: "rooms", label: "청소 필요" },
  { key: "name", label: "이름" },
];

const rateOf = (p: PortfolioProperty) => changeRate(p.today.sales, p.today.yesterdaySales);

/** 큰 값이 먼저 — 이름만 가나다순 */
function sortValue(p: PortfolioProperty, key: SortKey): number | string {
  switch (key) {
    case "today":
      return p.today.sales;
    case "change":
      return rateOf(p) ?? -Infinity;
    case "month":
      return p.month.sales;
    case "reviews":
      return p.reviews.unanswered * 1000 + p.reviews.lowRated;
    case "settle":
      return p.settle7;
    case "rooms":
      return p.roomStatus.dirty * 1000 + p.roomStatus.staleDirty;
    case "staff":
      return p.staff.onDuty;
    case "attention":
      // 급한 일 순위가 낮을수록 먼저 → 부호를 바꿔 큰 값이 먼저가 되게
      return -topAlertRank(p) * 100 + p.alerts.length;
    case "name":
      return p.name;
  }
}

function formatRate(rate: number | null) {
  if (rate === null) return "–";
  const abs = Math.abs(rate).toFixed(1);
  return rate > 0 ? `+${abs}%` : rate < 0 ? `−${abs}%` : "0.0%";
}

function Rate({ rate }: { rate: number | null }) {
  return (
    <span className={cx("ov-rate num", rate !== null && rate > 0 && "is-up", rate !== null && rate < 0 && "is-down")}>
      {formatRate(rate)}
    </span>
  );
}

function channelState(p: PortfolioProperty): { tone: BadgeTone; label: string } {
  const broken = p.channels.error + p.channels.authExpired;
  if (broken > 0) return { tone: "bad", label: `끊김 ${broken}` };
  if (p.channels.connected === 0) return { tone: "neutral", label: "미연결" };
  return { tone: "ok", label: `정상 ${p.channels.connected}` };
}

export function OverviewScreen({ data, switchProperty }: OverviewScreenProps) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "today", desc: true });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [allAlerts, setAllAlerts] = useState(false);
  const { totals } = data;

  const open = (p: PortfolioProperty, next = "/app") => {
    if (isPending) return;
    setError("");
    setPendingId(p.id);
    startTransition(async () => {
      const r = await switchProperty(p.id, next);
      if (r && !r.ok) {
        setError(r.message);
        setPendingId(null);
      }
    });
  };

  const rows = useMemo(() => {
    const list = [...data.properties];
    list.sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string, "ko") : (va as number) - (vb as number);
      const dir = sort.key === "name" ? (sort.desc ? -1 : 1) : sort.desc ? -1 : 1;
      return cmp * dir || a.name.localeCompare(b.name, "ko");
    });
    return list;
  }, [data.properties, sort]);

  const attention = useMemo(
    () =>
      data.properties
        .filter((p) => p.alerts.length > 0)
        .sort((a, b) => topAlertRank(a) - topAlertRank(b) || b.alerts.length - a.alerts.length),
    [data.properties],
  );

  const sortBy = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "name" }));

  const head = (key: SortKey, label: string, num = true) => {
    const active = sort.key === key;
    return (
      <th
        scope="col"
        className={cx(num && "is-num")}
        aria-sort={active ? (sort.desc ? "descending" : "ascending") : undefined}
      >
        <button type="button" className={cx("ov-sort", active && "is-active")} onClick={() => sortBy(key)}>
          {label}
          <Icon name="chevronDown" size={13} className={cx("ov-sort__icon", active && !sort.desc && "is-up")} />
        </button>
      </th>
    );
  };

  /** 셀 안 바로가기 — 그 업장으로 바꾸면서 해당 화면으로 (행 클릭과 겹치지 않게) */
  const jump = (p: PortfolioProperty, next: string, children: React.ReactNode, label: string) => (
    <button
      type="button"
      className="ov-jump"
      aria-label={`${p.name} ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        open(p, next);
      }}
    >
      {children}
    </button>
  );

  const monthRate = changeRate(totals.month.sales, totals.month.prevToDate);

  return (
    <div className={cx("ov", isPending && "is-switching")}>
      <PageHead
        title={formatLongDate(data.date)}
        desc={`업장 ${totals.properties}곳의 오늘 현황이에요. 업장을 누르면 그 업장 화면으로 들어가요.`}
        actions={
          <PmButton icon="plus" href="/app/onboarding?add=1">
            업장 추가
          </PmButton>
        }
      />

      {error && (
        <p className="ov-error" role="alert">
          {error}
        </p>
      )}

      <StatRow cols={4} label="전체 업장 요약">
        <Stat
          label="오늘 예약매출"
          prefix="₩"
          value={formatNumber(totals.today.sales)}
          delta={{ rate: changeRate(totals.today.sales, totals.today.yesterdaySales), label: "어제보다" }}
          foot={`예약 ${formatNumber(totals.today.bookings)}건`}
        />
        <Stat
          label="이번 달 매출"
          prefix="₩"
          value={formatNumber(totals.month.sales)}
          delta={{ rate: monthRate, label: "지난달 같은 날보다" }}
        />
        <Stat
          label="답글 기다리는 리뷰"
          value={formatNumber(totals.reviews.unanswered)}
          suffix="건"
          foot={totals.reviews.lowRated > 0 ? `별점 3점 이하 ${totals.reviews.lowRated}건` : "낮은 별점 없음"}
        />
        <Stat
          label="7일 안 정산 예정"
          prefix="₩"
          value={formatNumber(totals.settle7)}
          foot={`업장 ${data.properties.filter((p) => p.settle7 > 0).length}곳`}
        />
      </StatRow>

      {attention.length > 0 && (
        <section className="ov-attn" aria-labelledby="ov-attn-title">
          <header className="ov-attn__head">
            <h2 id="ov-attn-title">확인이 필요한 업장</h2>
            <span className="num">{attention.length}곳</span>
          </header>
          <ul>
            {(allAlerts ? attention : attention.slice(0, ATTN_LIMIT)).map((p) => {
              const top = p.alerts[0];
              const view = ALERT_VIEW[top.kind];
              const rest = p.alerts.slice(1);
              return (
                <li key={p.id} className={cx("ov-attn__row", `is-${view.tone}`, pendingId === p.id && "is-pending")}>
                  <Badge tone={view.tone} className="ov-attn__badge">
                    {view.label}
                  </Badge>
                  <button type="button" className="ov-attn__name" onClick={() => open(p)}>
                    {p.name}
                  </button>
                  <p className="ov-attn__msg">
                    {top.message}
                    {rest.length > 0 && (
                      <span className="ov-attn__more" title={rest.map((a: PortfolioAlert) => a.message).join("\n")}>
                        외 {rest.length}건
                      </span>
                    )}
                  </p>
                  <PmButton size="sm" onClick={() => open(p, top.link)} className="ov-attn__act">
                    {view.action}
                  </PmButton>
                </li>
              );
            })}
          </ul>
          {attention.length > ATTN_LIMIT && (
            <button type="button" className="ov-attn__toggle" onClick={() => setAllAlerts((v) => !v)}>
              {allAlerts ? "급한 곳만 보기" : `나머지 ${attention.length - ATTN_LIMIT}곳 더 보기`}
              <Icon name="chevronDown" size={14} className={cx(allAlerts && "is-up")} />
            </button>
          )}
        </section>
      )}

      <section className="ov-list" aria-labelledby="ov-list-title">
        <header className="ov-list__head">
          <h2 id="ov-list-title">업장별 현황</h2>
          <label className="ov-list__sort">
            <span>정렬</span>
            <select
              className="pm-input"
              value={sort.key}
              onChange={(e) => setSort({ key: e.target.value as SortKey, desc: e.target.value !== "name" })}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </header>

        <div className="ov-table-wrap pm-table-wrap">
          <table className="pm-table ov-table">
            <thead>
              <tr>
                {head("name", "업장", false)}
                {head("today", "오늘 매출")}
                {head("change", "전일비")}
                {head("month", "이번 달")}
                {head("reviews", "미답변(낮은 별점)")}
                {head("settle", "7일 안 정산")}
                {head("rooms", "객실 판매/청소/투숙")}
                {head("staff", "근무 중")}
                <th scope="col">채널</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const ch = channelState(p);
                const r = p.roomStatus;
                return (
                  <tr key={p.id} className={cx("ov-row", pendingId === p.id && "is-pending")} onClick={() => open(p)}>
                    <th scope="row" className="ov-name">
                      <button
                        type="button"
                        className="ov-name__btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          open(p);
                        }}
                      >
                        <strong>{p.name}</strong>
                        <small>
                          {TYPE_LABEL[p.type]} {p.rooms}실{p.role === "manager" && <span> 매니저</span>}
                        </small>
                      </button>
                    </th>
                    <td className="is-num">{formatNumber(p.today.sales)}</td>
                    <td className="is-num">
                      <Rate rate={rateOf(p)} />
                    </td>
                    <td className="is-num">{formatNumber(p.month.sales)}</td>
                    <td className="is-num">
                      {p.reviews.unanswered > 0 ? (
                        jump(
                          p,
                          "/app/reviews",
                          <>
                            {p.reviews.unanswered}
                            {p.reviews.lowRated > 0 && (
                              <span className="ov-low" title="별점 3점 이하">
                                ({p.reviews.lowRated})
                              </span>
                            )}
                          </>,
                          "리뷰 관리",
                        )
                      ) : (
                        <span className="is-muted">0</span>
                      )}
                    </td>
                    <td className="is-num">{formatNumber(p.settle7)}</td>
                    <td className="is-num">
                      {jump(
                        p,
                        "/app/ops",
                        <span className="ov-rooms">
                          <span title="판매 가능">{r.ready}</span>
                          <i aria-hidden>/</i>
                          <span
                            className={cx(r.staleDirty > 0 && "is-stale")}
                            title={
                              r.staleDirty > 0
                                ? `청소 필요 ${r.dirty}실 중 ${r.staleDirty}실이 2시간 넘음`
                                : "청소 필요"
                            }
                          >
                            {r.dirty}
                          </span>
                          <i aria-hidden>/</i>
                          <span title="투숙 중">{r.occupied}</span>
                        </span>,
                        `객실 판매 가능 ${r.ready}, 청소 필요 ${r.dirty}, 투숙 ${r.occupied} — 현장 업무`,
                      )}
                    </td>
                    <td className="is-num">
                      {p.staff.onDuty}명
                      {p.staff.missingClockOut > 0 && (
                        <span className="ov-low" title="퇴근 기록이 빠진 근무">
                          누락 {p.staff.missingClockOut}
                        </span>
                      )}
                    </td>
                    <td>
                      {jump(
                        p,
                        "/app/settings/channels",
                        <Badge tone={ch.tone} dot={ch.tone !== "neutral"}>
                          {ch.label}
                        </Badge>,
                        `채널 연동 ${ch.label}`,
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">합계 {totals.properties}곳</th>
                <td className="is-num">{formatNumber(totals.today.sales)}</td>
                <td className="is-num">
                  <Rate rate={changeRate(totals.today.sales, totals.today.yesterdaySales)} />
                </td>
                <td className="is-num">{formatNumber(totals.month.sales)}</td>
                <td className="is-num">{formatNumber(totals.reviews.unanswered)}</td>
                <td className="is-num">{formatNumber(totals.settle7)}</td>
                <td className="is-num">
                  <span className="ov-rooms">
                    {sum(rows, (p) => p.roomStatus.ready)}
                    <i aria-hidden>/</i>
                    {sum(rows, (p) => p.roomStatus.dirty)}
                    <i aria-hidden>/</i>
                    {sum(rows, (p) => p.roomStatus.occupied)}
                  </span>
                </td>
                <td className="is-num">{sum(rows, (p) => p.staff.onDuty)}명</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 휴대폰 — 표 대신 업장 카드 */}
        <ul className="ov-cards">
          {rows.map((p) => {
            const top = p.alerts[0];
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={cx("ov-card", pendingId === p.id && "is-pending")}
                  onClick={() => open(p)}
                >
                  <span className="ov-card__top">
                    <span className="ov-card__name">
                      <strong>{p.name}</strong>
                      <small>
                        {TYPE_LABEL[p.type]} {p.rooms}실
                      </small>
                    </span>
                    {top && <Badge tone={ALERT_VIEW[top.kind].tone}>{ALERT_VIEW[top.kind].label}</Badge>}
                  </span>
                  <span className="ov-card__figs">
                    <span>
                      <small>오늘 매출</small>
                      <b className="num">₩{formatNumber(p.today.sales)}</b>
                      <Rate rate={rateOf(p)} />
                    </span>
                    <span>
                      <small>미답변</small>
                      <b className="num">{p.reviews.unanswered}건</b>
                      {p.reviews.lowRated > 0 && <em className="ov-low">낮은 별점 {p.reviews.lowRated}</em>}
                    </span>
                    <span>
                      <small>청소 필요</small>
                      <b className="num">{p.roomStatus.dirty}실</b>
                      {p.roomStatus.staleDirty > 0 && <em className="ov-low">2시간 넘음 {p.roomStatus.staleDirty}</em>}
                    </span>
                  </span>
                  <Icon name="chevron" size={16} className="ov-card__go" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function sum(list: readonly PortfolioProperty[], f: (p: PortfolioProperty) => number) {
  return formatNumber(list.reduce((s, p) => s + f(p), 0));
}
