import type { ReactNode } from "react";
import { cx } from "@/shared";
import "./kpi.css";

/** KPI 카드 묶음 (3칸 / 4칸) */
export function KpiRow({ columns, children }: { columns: 3 | 4; children: ReactNode }) {
  return <div className={cx("kpi-row", `kpi-row--${columns}`)}>{children}</div>;
}

interface KpiCardProps {
  label: string;
  value: ReactNode;
  note: string;
  /** 보조 문구 색: 기본(강조) · soft(흐리게) · accent(포인트색) */
  noteTone?: "strong" | "soft" | "accent";
  size?: "md" | "lg";
}

export function KpiCard({ label, value, note, noteTone = "strong", size = "md" }: KpiCardProps) {
  return (
    <div className={cx("kpi", size === "lg" && "kpi--lg")}>
      <span className="kpi__label">{label}</span>
      <span className="kpi__value">{value}</span>
      <span className={cx("kpi__sub", noteTone !== "strong" && `kpi__sub--${noteTone}`)}>{note}</span>
    </div>
  );
}
