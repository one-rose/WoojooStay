"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  changeRate,
  periodSales,
  PORTFOLIO_ALERT_RANK,
  PORTFOLIO_PERIODS,
  topAlertRank,
  type PortfolioAlert,
  type PortfolioAlertKind,
  type PortfolioData,
  type PortfolioPeriod,
  type PortfolioProperty,
  type PropertyType,
  type SwitchPropertyAction,
} from "@/core";
import { cx, formatLongDate, formatNumber, formatWon } from "@/shared";
import { Badge, Icon, NextPayout, PageHead, PmButton, Stat, StatRow, type BadgeTone } from "../../components";
import "./overview.css";

interface OverviewScreenProps {
  data: PortfolioData;
  /** 업장을 바꾸고 그 업장 화면(next)으로 */
  switchProperty: SwitchPropertyAction;
  /** 매출 기간 (?period=) */
  period?: PortfolioPeriod;
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
  "channel-error": { label: "연동 끊김", tone: "bad", action: "연동 확인" },
  "payment-failed": { label: "결제 실패", tone: "bad", action: "카드 확인" },
  "low-rated": { label: "낮은 별점", tone: "warn", action: "리뷰 보기" },
  "no-staff": { label: "근무자 없음", tone: "warn", action: "근무 확인" },
  "stale-dirty": { label: "청소 지연", tone: "warn", action: "현장 업무" },
  "missing-clock-out": { label: "퇴근 누락", tone: "warn", action: "근무 기록" },
  "no-channel": { label: "채널 없음", tone: "neutral", action: "채널 연결" },
};

/** 할 일은 처음에 이만큼만 (나머지는 펼쳐서) */
const TODO_LIMIT = 6;

const todoKey = (p: PortfolioProperty, a: PortfolioAlert) => `${p.id}:${a.kind}`;

/** 오늘 숨긴 할 일 — localStorage 에 날짜와 함께 (다른 날이면 비움). 저장이 막힌 브라우저에서는 이 화면에서만 */
const HIDDEN_KEY = "uzu.ov.hidden";
const hiddenListeners = new Set<() => void>();
let hiddenFallback: string | null = null;
function readHidden(): string | null {
  try {
    return window.localStorage.getItem(HIDDEN_KEY);
  } catch {
    return hiddenFallback;
  }
}
function subscribeHidden(cb: () => void) {
  hiddenListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    hiddenListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function useHiddenToday(date: string): [string[], (v: string[]) => void] {
  const raw = useSyncExternalStore(subscribeHidden, readHidden, () => null);
  const list = useMemo(() => {
    try {
      const v = JSON.parse(raw ?? "null") as { date: string; keys: string[] } | null;
      return v && v.date === date ? v.keys : [];
    } catch {
      return [];
    }
  }, [raw, date]);
  const set = (keys: string[]) => {
    const next = JSON.stringify({ date, keys });
    hiddenFallback = next;
    try {
      window.localStorage.setItem(HIDDEN_KEY, next);
    } catch {
      /* 저장 못 해도 이 화면에서는 숨김 */
    }
    hiddenListeners.forEach((f) => f());
  };
  return [list, set];
}

type SortKey = "today" | "change" | "month" | "reviews" | "settle" | "rooms" | "staff" | "attention" | "name";

/** 알림 종류별로 열 화면 — 낮은 별점은 낮은 별점 분류로 바로 */
const alertLink = (a: PortfolioAlert) => (a.kind === "low-rated" ? "/app/reviews?tab=low" : a.link);

const SORTS: { key: SortKey; label: string }[] = [
  { key: "today", label: "매출" },
  { key: "attention", label: "급한 일" },
  { key: "change", label: "증감" },
  { key: "month", label: "이번 달 매출" },
  { key: "reviews", label: "미답변 리뷰" },
  { key: "settle", label: "7일 안 정산" },
  { key: "rooms", label: "청소 필요" },
  { key: "name", label: "이름" },
];

/** 고른 기간 매출의 앞 기간 대비 증감 */
const rateOf = (p: PortfolioProperty, period: PortfolioPeriod) => {
  const s = periodSales(p, period);
  return s.prevSales === null ? null : changeRate(s.sales, s.prevSales);
};

/** 큰 값이 먼저 — 이름만 가나다순 */
function sortValue(p: PortfolioProperty, key: SortKey, period: PortfolioPeriod): number | string {
  switch (key) {
    case "today":
      return periodSales(p, period).sales;
    case "change":
      return rateOf(p, period) ?? -Infinity;
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

function channelState(p: PortfolioProperty): { tone: BadgeTone | null; label: string } {
  const broken = p.channels.error + p.channels.authExpired;
  if (broken > 0) return { tone: "bad", label: `연동 끊김 ${broken}` };
  if (p.channels.connected === 0) return { tone: "neutral", label: "미연결" };
  // 정상은 배지 없이 회색 글자 — 문제만 배지
  return { tone: null, label: `${p.channels.connected}곳` };
}

export function OverviewScreen({ data, switchProperty, period = "today" }: OverviewScreenProps) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "today", desc: true });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [allAlerts, setAllAlerts] = useState(false);
  /** 오늘은 숨긴 할 일 (이 기기에서만, 날짜가 바뀌면 다시 보임) */
  const [hidden, setHidden] = useHiddenToday(data.date);
  const { totals } = data;
  const router = useRouter();
  const periodView = PORTFOLIO_PERIODS.find((x) => x.key === period) ?? PORTFOLIO_PERIODS[0];
  const [periodPending, startPeriod] = useTransition();
  const setPeriod = (key: PortfolioPeriod) =>
    startPeriod(() =>
      router.push(key === "today" ? "/app/overview" : `/app/overview?period=${key}`, { scroll: false }),
    );

  const open = (p: PortfolioProperty, next = "/app") => {
    if (isPending) return;
    // 리뷰는 업장을 바꾸지 않고 통합 리뷰함에서 그 업장 것만 걸러서 (?tab=low 같은 분류는 그대로)
    if (next === "/app/reviews" || next.startsWith("/app/reviews?")) {
      const q = new URLSearchParams(next.split("?")[1] ?? "");
      q.set("property", p.id);
      router.push(`/app/overview/reviews?${q}`);
      return;
    }
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
      const va = sortValue(a, sort.key, period);
      const vb = sortValue(b, sort.key, period);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string, "ko") : (va as number) - (vb as number);
      const dir = sort.key === "name" ? (sort.desc ? -1 : 1) : sort.desc ? -1 : 1;
      return cmp * dir || a.name.localeCompare(b.name, "ko");
    });
    return list;
  }, [data.properties, sort, period]);

  /** 할 일 한 줄씩 — 업장 × 알림, 급한 순 (같은 순위면 매출 큰 업장 먼저) */
  const allTodo = useMemo(
    () =>
      data.properties
        .flatMap((p) => p.alerts.map((a) => ({ p, a })))
        .sort(
          (x, y) =>
            PORTFOLIO_ALERT_RANK[x.a.kind] - PORTFOLIO_ALERT_RANK[y.a.kind] || y.p.month.sales - x.p.month.sales,
        ),
    [data.properties],
  );
  const todo = allTodo.filter((t) => !hidden.includes(todoKey(t.p, t.a)));
  const hide = (key: string) => setHidden([...hidden, key]);

  const sortBy = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "name" }));

  const head = (key: SortKey, label: string, num = true, unit?: string) => {
    const active = sort.key === key;
    return (
      <th
        scope="col"
        className={cx(num && "is-num")}
        aria-sort={active ? (sort.desc ? "descending" : "ascending") : undefined}
      >
        <button type="button" className={cx("ov-sort", active && "is-active")} onClick={() => sortBy(key)}>
          {label}
          {unit && <small className="ov-unit">({unit})</small>}
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
  const total = totals.period ?? {
    sales: period === "yesterday" ? totals.today.yesterdaySales : totals.today.sales,
    bookings: period === "yesterday" ? 0 : totals.today.bookings,
    prevSales: period === "yesterday" ? 0 : totals.today.yesterdaySales,
  };
  const totalRate = changeRate(total.sales, total.prevSales);
  const salesLabel = `${periodView.label} 입실 매출`;
  const hasCosts = data.properties.some((p) => p.costs);

  return (
    <div className={cx("ov", isPending && "is-switching")}>
      <PageHead
        title={formatLongDate(data.date)}
        desc={`업장 ${totals.properties}곳의 현황이에요. 업장을 누르면 그 업장 화면으로 들어가요.`}
        actions={
          // 업장 추가는 사장님인 업장이 있을 때만 (매니저로만 일하는 사람은 숨김)
          data.properties.some((p) => p.role === "owner") ? (
            <PmButton icon="plus" href="/app/onboarding?add=1">
              업장 추가
            </PmButton>
          ) : undefined
        }
      />

      {error && (
        <p className="ov-error" role="alert">
          {error}
        </p>
      )}

      {/* 지금 처리할 일 (S1) — 업장 · 무엇 · 버튼 하나. 해결되면 다음 수집 때 목록에서 빠진다 */}
      <section className="ov-todo" aria-labelledby="ov-todo-title">
        <header className="ov-todo__head">
          <h2 id="ov-todo-title">
            지금 처리할 일 <span className="num">{todo.length}</span>건
          </h2>
          {hidden.length > 0 && (
            <button type="button" className="ov-todo__unhide" onClick={() => setHidden([])}>
              숨긴 {hidden.length}건 다시 보기
            </button>
          )}
        </header>
        {todo.length === 0 ? (
          <p className="ov-todo__empty">
            <Icon name="check" size={16} />
            지금 손볼 일이 없어요. 연동·결제·낮은 별점·청소 지연이 생기면 여기에 바로 올라와요.
          </p>
        ) : (
          <ol className="ov-todo__list">
            {(allAlerts ? todo : todo.slice(0, TODO_LIMIT)).map(({ p, a }) => {
              const view = ALERT_VIEW[a.kind];
              const key = todoKey(p, a);
              return (
                <li key={key} className={cx("ov-todo__row", `is-${view.tone}`, pendingId === p.id && "is-pending")}>
                  <span className="ov-todo__kind">{view.label}</span>
                  <button type="button" className="ov-todo__name" onClick={() => open(p)}>
                    {p.name}
                  </button>
                  <p className="ov-todo__msg">{a.message}</p>
                  <PmButton size="sm" onClick={() => open(p, alertLink(a))} className="ov-todo__act">
                    {view.action}
                  </PmButton>
                  <button
                    type="button"
                    className="ov-todo__hide"
                    aria-label={`${p.name} ${view.label} 오늘은 숨기기`}
                    title="오늘은 숨기기"
                    onClick={() => hide(key)}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        {todo.length > TODO_LIMIT && (
          <button type="button" className="ov-todo__toggle" onClick={() => setAllAlerts((v) => !v)}>
            {allAlerts ? "급한 것만 보기" : `${todo.length - TODO_LIMIT}건 더 보기`}
            <Icon name="chevronDown" size={14} className={cx(allAlerts && "is-up")} />
          </button>
        )}
      </section>

      <div className="ov-period">
        <div className="pm-seg" role="group" aria-label="매출 기간">
          {PORTFOLIO_PERIODS.map((x) => (
            <button
              key={x.key}
              type="button"
              className="pm-seg__btn"
              aria-pressed={x.key === period}
              onClick={() => setPeriod(x.key)}
              disabled={periodPending}
            >
              {x.label}
            </button>
          ))}
        </div>
        <span className="ov-period__note">매출은 입실일 기준이에요.</span>
      </div>

      <NextPayout
        today={data.date}
        amount={totals.settle7}
        label="7일 안 입금 예정"
        note={`업장 ${data.properties.filter((p) => p.settle7 > 0).length}곳 합계`}
        href={null}
      />

      <StatRow cols={3} label="전체 업장 요약" slim>
        <Stat
          label={salesLabel}
          prefix="₩"
          value={formatNumber(total.sales)}
          delta={{ rate: totalRate, label: periodView.prev }}
          foot={total.bookings > 0 ? `예약 ${formatNumber(total.bookings)}건` : undefined}
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
      </StatRow>

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
                {head("today", `${periodView.label} 매출`, true, "원")}
                {head("change", period === "week" ? "지난주비" : "전일비")}
                {head("month", "이번 달", true, "원")}
                {hasCosts && (
                  <th scope="col" className="is-num" title="이번 달 지출 + 인건비 (급여 확정 전이면 계산 중 금액)">
                    비용<small className="ov-unit">(원)</small>
                  </th>
                )}
                {head("reviews", "미답변", true, "낮은 별점")}
                {head("settle", "7일 정산", true, "원")}
                {head("rooms", "청소 필요")}
                {head("staff", "근무 중")}
                <th scope="col">채널</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const ch = channelState(p);
                const r = p.roomStatus;
                const noStaff = p.alerts.some((a) => a.kind === "no-staff");
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
                    <td className="is-num">{formatNumber(periodSales(p, period).sales)}</td>
                    <td className="is-num">
                      <Rate rate={rateOf(p, period)} />
                    </td>
                    <td className="is-num">{formatNumber(p.month.sales)}</td>
                    {hasCosts && (
                      <td className="is-num">
                        {p.costs && p.costs.expenses + p.costs.payroll > 0 ? (
                          <span className="ov-cost">
                            {formatNumber(p.costs.expenses + p.costs.payroll)}
                            <small>
                              {p.costs.costRatio === null
                                ? "매출 없음"
                                : `매출의 ${(p.costs.costRatio * 100).toFixed(1)}%`}
                            </small>
                          </span>
                        ) : (
                          <span className="is-muted">{p.costs ? "0" : "–"}</span>
                        )}
                      </td>
                    )}
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
                          "리뷰",
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
                          <span className={cx("ov-rooms__dirty", r.staleDirty > 0 && "is-stale")}>{r.dirty}실</span>
                          <small className={cx("ov-rooms__sub", r.staleDirty > 0 && "is-stale")}>
                            {r.staleDirty > 0
                              ? `2시간 넘은 방 ${r.staleDirty}`
                              : `빈 방 ${r.ready}, 투숙 ${r.occupied}`}
                          </small>
                        </span>,
                        `청소 필요 ${r.dirty}실, 판매 가능 ${r.ready}실, 투숙 ${r.occupied}실 — 현장 업무`,
                      )}
                    </td>
                    <td className="is-num">
                      {noStaff ? (
                        jump(p, "/app/staff", <span className="ov-nostaff">근무자 없음</span>, "근무자 없음 — 알바관리")
                      ) : (
                        <>{p.staff.onDuty}명</>
                      )}
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
                        ch.tone ? (
                          <Badge tone={ch.tone} dot={ch.tone !== "neutral"}>
                            {ch.label}
                          </Badge>
                        ) : (
                          <span className="ov-ch-ok">{ch.label}</span>
                        ),
                        `채널 연동 ${ch.label}${ch.tone ? "" : " 연결"}`,
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">합계 {totals.properties}곳</th>
                <td className="is-num">{formatNumber(total.sales)}</td>
                <td className="is-num">
                  <Rate rate={totalRate} />
                </td>
                <td className="is-num">{formatNumber(totals.month.sales)}</td>
                {hasCosts && (
                  <td className="is-num">
                    {totals.costs ? formatNumber(totals.costs.expenses + totals.costs.payroll) : "–"}
                  </td>
                )}
                <td className="is-num">{formatNumber(totals.reviews.unanswered)}</td>
                <td className="is-num">{formatNumber(totals.settle7)}</td>
                <td className="is-num">{sum(rows, (p) => p.roomStatus.dirty)}실</td>
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
                      <small>{periodView.label} 매출</small>
                      <b className="num">{formatWon(periodSales(p, period).sales)}</b>
                      <Rate rate={rateOf(p, period)} />
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
                    <span>
                      <small>근무 중</small>
                      {p.alerts.some((a) => a.kind === "no-staff") ? (
                        <b className="num ov-nostaff">0명</b>
                      ) : (
                        <b className="num">{p.staff.onDuty}명</b>
                      )}
                      {p.staff.missingClockOut > 0 && <em className="ov-low">퇴근 누락 {p.staff.missingClockOut}</em>}
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
