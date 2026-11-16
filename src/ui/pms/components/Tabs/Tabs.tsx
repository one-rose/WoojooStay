"use client";

import { cx } from "@/shared";
import "./tabs.css";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  /** line: 밑줄형 (화면 안 큰 구분) · pill: 알약형 (목록 필터) */
  variant?: "line" | "pill";
}

export function Tabs<T extends string>({ items, value, onChange, label, variant = "line" }: TabsProps<T>) {
  return (
    <div className={cx("pm-tabs", `pm-tabs--${variant}`)} role="tablist" aria-label={label}>
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          className={cx("pm-tabs__tab", value === t.id && "is-on")}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && <span className="pm-tabs__count num">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
