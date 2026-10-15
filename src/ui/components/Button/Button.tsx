import type { ReactNode } from "react";
import { cx } from "@/shared";
import styles from "./Button.module.css";

interface ButtonProps {
  variant?: "primary" | "ghost";
  size?: "md" | "sm" | "xs" | "xl";
  /** 있으면 <a>, 없으면 <button> */
  href?: string;
  className?: string;
  children: ReactNode;
}

export function Button({ variant = "primary", size = "md", href, className, children }: ButtonProps) {
  const classes = cx(styles.button, styles[variant], styles[size], className);
  if (href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={classes}>
      {children}
    </button>
  );
}
