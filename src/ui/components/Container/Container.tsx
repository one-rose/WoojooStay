import type { ReactNode } from "react";
import { cx } from "@/shared";
import styles from "./Container.module.css";

interface ContainerProps {
  className?: string;
  children: ReactNode;
}

/** 본문 폭(1288px) 컨테이너. 좌우 여백은 --gutter */
export function Container({ className, children }: ContainerProps) {
  return <div className={cx(styles.container, className)}>{children}</div>;
}
