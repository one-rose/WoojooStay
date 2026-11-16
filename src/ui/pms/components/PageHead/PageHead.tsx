import type { ReactNode } from "react";
import "./page-head.css";

interface PageHeadProps {
  title: string;
  desc?: ReactNode;
  actions?: ReactNode;
}

/** 화면 머리 — 제목 + 한 줄 설명 + 오른쪽 동작. 제목 위 꼬리표는 두지 않는다 (PMS-DESIGN-V2) */
export function PageHead({ title, desc, actions }: PageHeadProps) {
  return (
    <header className="pm-page-head">
      <div className="pm-page-head__text">
        <h1 className="pm-page-head__title">{title}</h1>
        {desc && <p className="pm-page-head__desc">{desc}</p>}
      </div>
      {actions && <div className="pm-page-head__actions">{actions}</div>}
    </header>
  );
}
