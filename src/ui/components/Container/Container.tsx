import type { ReactNode } from "react";
import { cx } from "@/shared";

/** 가운데 정렬 컨테이너 (최대 1288px). 스타일: styles/base.css 의 .container */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("container", className)}>{children}</div>;
}
