import type { ReactNode } from "react";
import { cx } from "@/shared";
import "./badge.css";

export type BadgeTone = "ok" | "warn" | "bad" | "info" | "neutral";

interface BadgeProps {
  tone?: BadgeTone;
  /** 앞에 점 표시 — 채널 연동 상태에만 쓴다 */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

/** 바뀌는 상태(정상·오류·확인 필요·판매 중지·계약·결제 상태)에만 쓴다. 종류 표시는 Tag */
export function Badge({ tone = "neutral", dot, className, children }: BadgeProps) {
  return <span className={cx("pm-badge", `pm-badge--${tone}`, dot && "pm-badge--dot", className)}>{children}</span>;
}

/** 상태가 아닌 종류 표시 — 선만 있는 4px 태그 (요금제 이름, 키워드 등) */
export function Tag({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cx("pm-tag", className)}>{children}</span>;
}
