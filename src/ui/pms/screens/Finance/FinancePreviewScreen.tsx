"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ADVANCE_FEE_DAILY,
  advanceQuote,
  settleWithin,
  type ActionResult,
  type FinanceKind,
  type FinancePreviewData,
} from "@/core";
import { cx, daysBetween, formatNumber, formatShortDate, formatWon } from "@/shared";
import { ChannelChip, PageHead, PmButton, Stat, StatRow } from "../../components";
import "./finance.css";

interface FinancePreviewScreenProps {
  kind: FinanceKind;
  data: FinancePreviewData;
  /** 관심 표시 — 운영팀 도입 문의로 남긴다. 없으면(체험 모드) 화면에서만 */
  interest?: (kind: FinanceKind) => Promise<ActionResult>;
}

const TITLE: Record<FinanceKind, string> = { settle: "매출선정산", advance: "미래매출선지급" };
const pct = (v: number) => `${(v * 100).toFixed(3).replace(/0+$/, "")}%`;

/** 금융 미리보기 — 신청·입금 없이 우리 업장 숫자로 예시만 */
export function FinancePreviewScreen({ kind, data, interest }: FinancePreviewScreenProps) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      setError("");
      if (interest) {
        const r = await interest(kind);
        if (!r.ok) return setError(r.message || "전달하지 못했어요. 잠시 후 다시 눌러 주세요.");
      }
      setSent(true);
    });

  return (
    <div className="fin">
      <PageHead
        title={`${TITLE[kind]} 미리보기`}
        desc={
          kind === "settle"
            ? "채널 정산일을 기다리지 않고 정산 예정 금액을 먼저 받는 서비스예요. 지금은 미리보기라 신청이나 입금은 되지 않아요."
            : "앞으로 들어올 매출을 근거로 운영 자금을 먼저 받는 서비스예요. 지금은 미리보기라 신청이나 입금은 되지 않아요."
        }
      />

      <nav className="fin-switch" aria-label="금융 서비스">
        <Link
          href="/app/finance/settle"
          className={cx(kind === "settle" && "is-on")}
          aria-current={kind === "settle" ? "page" : undefined}
        >
          매출선정산
        </Link>
        <Link
          href="/app/finance/advance"
          className={cx(kind === "advance" && "is-on")}
          aria-current={kind === "advance" ? "page" : undefined}
        >
          미래매출선지급
        </Link>
      </nav>

      <p className="fin-stage">
        <strong>2단계 준비 중</strong>
        IBK기업은행과 함께 WOOJOO ORBIT으로 준비하고 있어요. 아래 금액은 {data.propertyName}의 실제 정산·매출 데이터로
        계산한 예시예요.
      </p>

      {kind === "settle" ? <SettlePreview data={data} /> : <AdvancePreview data={data} />}

      <section className="fin-interest" aria-labelledby="fin-interest-title">
        <div>
          <h2 id="fin-interest-title">{TITLE[kind]}이 열리면 먼저 알려드릴까요?</h2>
          <p>누르면 운영팀에 관심 업장으로 전달돼요. 신청이나 심사가 시작되는 것은 아니에요.</p>
        </div>
        {sent ? (
          <p className="fin-interest__done" role="status">
            운영팀에 전달했어요. 준비되면 먼저 연락드릴게요.
          </p>
        ) : (
          <PmButton variant="primary" onClick={send} disabled={pending}>
            {pending ? "전달하는 중…" : "관심 있어요"}
          </PmButton>
        )}
        {error && (
          <p className="pm-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

function SettlePreview({ data }: { data: FinancePreviewData }) {
  const rows = data.settlements.map((s) => ({ ...s, q: advanceQuote(s.amount, daysBetween(data.date, s.date)) }));
  const d7 = settleWithin(data.settlements, data.date, 7);
  const d30 = settleWithin(data.settlements, data.date, 30);
  const getMin = rows.reduce((sum, r) => sum + r.q.getMin, 0);
  const getMax = rows.reduce((sum, r) => sum + r.q.getMax, 0);
  const feeMin = rows.reduce((sum, r) => sum + r.q.feeMin, 0);
  const feeMax = rows.reduce((sum, r) => sum + r.q.feeMax, 0);

  return (
    <>
      <StatRow cols={3} label="정산 예정 요약">
        <Stat label="7일 안 정산 예정" prefix="₩" value={formatNumber(d7)} />
        <Stat label="30일 안 정산 예정" prefix="₩" value={formatNumber(d30)} foot={`${rows.length}건`} />
        <Stat
          label="오늘 받을 수 있는 금액 (예시)"
          prefix="₩"
          value={formatNumber(getMin)}
          foot={
            rows.length
              ? `최대 ${formatWon(getMax)}, 수수료 ${formatWon(feeMin)}~${formatNumber(feeMax)}`
              : "정산 예정이 없어요"
          }
        />
      </StatRow>

      <section className="fin-panel" aria-labelledby="fin-table-title">
        <header className="fin-panel__head">
          <h2 id="fin-table-title">30일 안 정산 예정</h2>
          <span className="num">합계 {formatWon(d30)}</span>
        </header>
        {rows.length === 0 ? (
          <p className="fin-empty">30일 안에 들어올 정산이 없어요. 채널을 연결하면 정산 예정이 여기에 모여요.</p>
        ) : (
          <>
            <div className="pm-table-wrap fin-table">
              <table className="pm-table">
                <thead>
                  <tr>
                    <th scope="col">정산 예정일</th>
                    <th scope="col">채널</th>
                    <th scope="col" className="is-num">
                      정산 금액
                    </th>
                    <th scope="col" className="is-num">
                      남은 날
                    </th>
                    <th scope="col" className="is-num">
                      예상 수수료
                    </th>
                    <th scope="col" className="is-num">
                      오늘 받는 금액
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.date}-${r.channel}`}>
                      <td className="num">{formatShortDate(r.date)}</td>
                      <td>
                        <ChannelChip channel={r.channel} name={r.channelName} />
                      </td>
                      <td className="is-num">{formatNumber(r.amount)}</td>
                      <td className="is-num">{r.q.days === 0 ? "오늘" : `${r.q.days}일`}</td>
                      <td className="is-num is-muted">
                        {r.q.feeMax === 0 ? "없음" : `${formatNumber(r.q.feeMin)}~${formatNumber(r.q.feeMax)}`}
                      </td>
                      <td className="is-num">
                        <b>{formatNumber(r.q.getMin)}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* 휴대폰 — 표 대신 목록 */}
            <ul className="fin-cards">
              {rows.map((r) => (
                <li key={`${r.date}-${r.channel}`}>
                  <span className="fin-cards__top">
                    <ChannelChip channel={r.channel} name={r.channelName} />
                    <span className="num">
                      {formatShortDate(r.date)} ({r.q.days === 0 ? "오늘" : `${r.q.days}일 뒤`})
                    </span>
                  </span>
                  <span className="fin-cards__row">
                    <small>정산 금액</small>
                    <span className="num">{formatWon(r.amount)}</span>
                  </span>
                  <span className="fin-cards__row">
                    <small>오늘 받는 금액</small>
                    <b className="num">{formatWon(r.q.getMin)}</b>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="fin-note">
          수수료는 하루 {pct(ADVANCE_FEE_DAILY.min)}~{pct(ADVANCE_FEE_DAILY.max)}로 가정한 예시예요 (사업소개서 기준).
          오늘 받는 금액은 수수료를 높게 잡은 쪽이에요. 실제 한도와 수수료는 IBK기업은행 심사로 정해져요.
        </p>
      </section>
    </>
  );
}

function AdvancePreview({ data }: { data: FinancePreviewData }) {
  // 다 지난 달만 평균 (진행 중인 이번 달은 빼고 최근 3개월)
  const done = data.trend.slice(0, -1).slice(-3);
  const avg = done.length ? Math.round(done.reduce((s, m) => s + m.sales, 0) / done.length) : 0;
  const maxSales = Math.max(1, ...data.trend.map((m) => m.sales));
  return (
    <>
      <StatRow cols={3} label="미래 매출 요약">
        <Stat label="최근 3개월 평균 매출" prefix="₩" value={formatNumber(avg)} foot={`${done.length}개월 기준`} />
        <Stat
          label="이번 달 남은 입실 예정 매출"
          prefix={data.upcomingSales === null ? undefined : "₩"}
          value={data.upcomingSales === null ? "–" : formatNumber(data.upcomingSales)}
          foot="내일부터 말일까지 들어온 예약"
        />
        <Stat label="선지급 한도" value="심사 뒤 결정" foot="매출 흐름과 정산 기록으로 정해져요" />
      </StatRow>

      <section className="fin-panel" aria-labelledby="fin-trend-title">
        <header className="fin-panel__head">
          <h2 id="fin-trend-title">월별 매출</h2>
          <span>입실일 기준</span>
        </header>
        <ol className="fin-bars">
          {data.trend.map((m, i) => (
            <li key={m.month}>
              <span className="num">{Number(m.month.slice(5))}월</span>
              <span className="fin-bars__track" aria-hidden>
                <span
                  className={cx("fin-bars__fill", i === data.trend.length - 1 && "is-now")}
                  style={{ width: `${(m.sales / maxSales) * 100}%` }}
                />
              </span>
              <span className="num">
                {formatWon(m.sales)}
                {i === data.trend.length - 1 && <small> 진행 중</small>}
              </span>
            </li>
          ))}
        </ol>
        <p className="fin-note">
          미래매출선지급은 이런 매출 흐름을 근거로 다음 달 매출의 일부를 먼저 받는 방식이에요. 한도·수수료·상환 방식은
          IBK기업은행과 정하는 중이라 아직 숫자로 보여드리지 않아요.
        </p>
      </section>
    </>
  );
}
