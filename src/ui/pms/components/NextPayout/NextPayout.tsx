import Link from "next/link";
import { daysBetween, formatShortDate, formatWonCompact } from "@/shared";
import { Icon } from "../Icon/Icon";
import "./next-payout.css";

interface NextPayoutProps {
  /** 기준일 (오늘) YYYY-MM-DD */
  today: string;
  /** 다음 입금일 — 없으면 기간 합계만 (전체 현황처럼 날짜별 정산이 없을 때) */
  date?: string;
  amount: number;
  /** 금액 옆 보조 ("야놀자 외 1곳", "업장 9곳") */
  note?: string;
  /** 날짜가 없을 때 앞 말 ("7일 안 입금") */
  label?: string;
  /** 누르면 갈 곳 — null 이면 링크 없이 (전체 현황) */
  href?: string | null;
}

/** "310만 원" — 만 원 아래는 "8,000원" */
export const wonWords = (n: number) => (Math.abs(n) >= 10_000 ? `${formatWonCompact(n)} 원` : formatWonCompact(n));

function when(today: string, date: string) {
  const n = daysBetween(today, date);
  return n === 0 ? "오늘" : n === 1 ? "내일" : `${n}일 뒤`;
}

/**
 * 다음 입금 한 줄 (S3) — 홈·전체 현황 맨 위, 장부 정산 캘린더의 날짜 표기와 같은 모양.
 * 토스페이먼츠 상점관리자의 "정산 예정" 한 줄처럼: 날짜 · 금액 · 어디서, 누르면 정산 캘린더.
 */
export function NextPayout({
  today,
  date,
  amount,
  note,
  label = "7일 안 입금 예정",
  href = "/app/ledger",
}: NextPayoutProps) {
  if (amount <= 0) return null;
  const body = (
    <>
      <Icon name="settle" size={16} className="pm-payout__icon" />
      <span className="pm-payout__label">{date ? "다음 입금" : label}</span>
      {date && (
        <span className="pm-payout__date num">
          {formatShortDate(date)}
          <small>{when(today, date)}</small>
        </span>
      )}
      <strong className="pm-payout__amount num">{wonWords(amount)}</strong>
      {note && <span className="pm-payout__note">{note}</span>}
      {href && (
        <span className="pm-payout__go">
          정산 캘린더
          <Icon name="chevron" size={14} />
        </span>
      )}
    </>
  );
  if (!href) return <p className="pm-payout pm-payout--static">{body}</p>;
  return (
    <Link href={href} className="pm-payout">
      {body}
    </Link>
  );
}
