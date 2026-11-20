import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/shared";
import "./stat.css";

interface StatDelta {
  /** 증감률(%) — null 이면 표시하지 않음 */
  rate: number | null;
  /** 앞에 붙는 말 ("어제보다", "전월보다") */
  label: string;
  /** 줄어드는 게 좋은 값(지출 등)이면 "down" */
  good?: "up" | "down";
}

interface StatProps {
  label: string;
  value: ReactNode;
  /** "₩" 등 숫자 앞 단위 */
  prefix?: string;
  /** "건" 등 숫자 뒤 단위 */
  suffix?: string;
  /** 증감 — 색 글자로만 (+12.3% / −4.1%) */
  delta?: StatDelta;
  /** 아래 보조 한 줄 */
  foot?: ReactNode;
  /** 칸 전체를 링크로 */
  href?: string;
  /** 숫자 대신 글자 값 ("연결 안 됨") — 큰 숫자 크기 대신 15px/600 (D-23) */
  text?: boolean;
}

function formatRate(rate: number) {
  const abs = Math.abs(rate).toFixed(1);
  return rate > 0 ? `+${abs}%` : rate < 0 ? `−${abs}%` : "0.0%";
}

/** 요약 띠의 한 칸 — 작은 라벨 · 큰 숫자 · 보조 한 줄 */
export function Stat({ label, value, prefix, suffix, delta, foot, href, text }: StatProps) {
  const showDelta = delta && delta.rate !== null;
  const good = showDelta && (delta.good === "down" ? delta.rate! < 0 : delta.rate! > 0);
  const bad = showDelta && (delta.good === "down" ? delta.rate! > 0 : delta.rate! < 0);
  const body = (
    <>
      <span className="pm-stat__label">{label}</span>
      <span className={cx("pm-stat__value", text ? "pm-stat__value--text" : "num")}>
        {prefix && <span className="pm-stat__unit">{prefix}</span>}
        {value}
        {suffix && <span className="pm-stat__unit pm-stat__unit--after">{suffix}</span>}
      </span>
      {(showDelta || foot) && (
        <span className="pm-stat__foot">
          {showDelta && (
            <span>
              {delta.label}{" "}
              <span className={cx("pm-stat__delta num", good && "is-good", bad && "is-bad")}>
                {formatRate(delta.rate!)}
              </span>
            </span>
          )}
          {foot && <span>{foot}</span>}
        </span>
      )}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="pm-stat pm-stat--link">
        {body}
      </Link>
    );
  }
  return <div className="pm-stat">{body}</div>;
}

/** 요약 띠 — 테두리 있는 패널 하나를 세로선으로 나눈다 */
export function StatRow({
  children,
  cols = 4,
  label,
  slim,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  label?: string;
  /** 얇은 띠 — 할 일 목록 아래에 깔리는 보조 숫자 (전체 현황) */
  slim?: boolean;
}) {
  return (
    <section className={cx("pm-stats", `pm-stats--${cols}`, slim && "pm-stats--slim")} aria-label={label ?? "요약"}>
      {children}
    </section>
  );
}
