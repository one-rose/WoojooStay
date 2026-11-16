"use client";

import Link from "next/link";
import { Icon } from "../Icon/Icon";
import "../PmButton/pm-button.css";
import "./error-state.css";

interface ErrorStateProps {
  title?: string;
  message?: string;
  /** 다시 시도 (error.tsx 의 retry) */
  onRetry?: () => void;
  /** 돌아갈 곳 */
  homeHref?: string;
  homeLabel?: string;
  /** 오류 추적 번호 (서버 로그와 맞춰 볼 때) */
  digest?: string;
  /** 전체 화면(사이드바 없는 화면)용 */
  full?: boolean;
}

/** 화면을 불러오지 못했을 때 · 없는 주소일 때 */
export function ErrorState({
  title = "화면을 불러오지 못했어요",
  message = "잠시 후 다시 시도해 주세요. 계속 안 되면 고객센터로 알려 주세요.",
  onRetry,
  homeHref,
  homeLabel = "홈으로",
  digest,
  full,
}: ErrorStateProps) {
  return (
    <section className={full ? "pm-errstate pm-errstate--full" : "pm-errstate"} role="alert">
      <span className="pm-errstate__icon" aria-hidden>
        <Icon name="alert" size={22} />
      </span>
      <h1 className="pm-errstate__title">{title}</h1>
      <p className="pm-errstate__msg">{message}</p>
      <div className="pm-errstate__actions">
        {onRetry && (
          <button type="button" className="pm-btn pm-btn--navy" onClick={onRetry}>
            <Icon name="sync" size={16} />
            <span>다시 시도</span>
          </button>
        )}
        {homeHref && (
          <Link href={homeHref} className="pm-btn pm-btn--ghost">
            <span>{homeLabel}</span>
          </Link>
        )}
      </div>
      {digest && <p className="pm-errstate__digest num">오류 번호 {digest}</p>}
    </section>
  );
}
