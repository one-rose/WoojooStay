import type { ReactNode } from "react";
import { cx } from "@/shared";
import "./section.css";

interface SectionProps {
  id?: string;
  /** alt: 연한 회색 배경 */
  tone?: "default" | "alt";
  /** 섹션별 여백 등 추가 클래스 (예: "section--s3", "cases") */
  className?: string;
  children: ReactNode;
}

export function Section({ id, tone = "default", className, children }: SectionProps) {
  return (
    <section id={id} className={cx("section", tone === "alt" && "section--alt", className)}>
      {children}
    </section>
  );
}
