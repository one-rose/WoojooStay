import type { ReactNode } from "react";
import { cx } from "@/shared";
import styles from "./Section.module.css";

interface SectionProps {
  id?: string;
  /** default: 흰 배경 · alt: 연한 배경 */
  tone?: "default" | "alt";
  /** 여백(padding)은 각 섹션 스타일에서 지정한다 */
  className?: string;
  children: ReactNode;
}

export function Section({ id, tone = "default", className, children }: SectionProps) {
  return (
    <section id={id} className={cx(styles[tone], className)}>
      {children}
    </section>
  );
}
