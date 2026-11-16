import type { ReactNode } from "react";
import { cx } from "@/shared";
import "./table.css";

/** 가로 스크롤되는 표 틀. 안에 <table className="pm-table"> 를 넣는다. */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("pm-table-wrap", className)}>{children}</div>;
}
