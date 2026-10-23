import type { ReactNode } from "react";
import { cx } from "@/shared";
import "./pill.css";

/** pill.css 의 변형 (.pill--lg 등) — 여러 개를 함께 쓸 수 있다 */
export type PillModifier = "lg" | "sm" | "soft" | "tint" | "date" | "num" | "road";

/** 알약 모양 라벨 (섹션 이름표, 상태 표시 등) */
export function Pill({ modifiers = [], children }: { modifiers?: readonly PillModifier[]; children: ReactNode }) {
  return <span className={cx("pill", ...modifiers.map((m) => `pill--${m}`))}>{children}</span>;
}
