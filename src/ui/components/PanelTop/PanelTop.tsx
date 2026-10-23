import type { ReactNode } from "react";
import { cx } from "@/shared";
import "./panel-top.css";

/** 패널 상단 줄: 제목 + 오른쪽 상태 표시 */
export function PanelTop({ title, aside, plain = false }: { title: string; aside: ReactNode; plain?: boolean }) {
  return (
    <div className={cx("panel-top", plain && "panel-top--plain")}>
      <strong>{title}</strong>
      {aside}
    </div>
  );
}

/** 보기용 탭 줄 (전체 84 · 미답변 8 …) */
export function Tabs({ tabs }: { tabs: readonly { label: string; active?: boolean }[] }) {
  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <span key={tab.label} className={tab.active ? "is-on" : undefined}>
          {tab.label}
        </span>
      ))}
    </div>
  );
}
