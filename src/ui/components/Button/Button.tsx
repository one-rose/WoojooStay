import type { ReactNode } from "react";
import { cx } from "@/shared";
import "./button.css";

interface ButtonProps {
  variant?: "grad" | "ghost";
  size?: "md" | "sm" | "xs" | "xl";
  /** 있으면 <a>, 없으면 <button type="button"> */
  href?: string;
  className?: string;
  children: ReactNode;
}

export function Button({ variant = "grad", size = "md", href, className, children }: ButtonProps) {
  const classes = cx("btn", `btn--${variant}`, size !== "md" && `btn--${size}`, className);
  return href ? (
    <a href={href} className={classes}>
      {children}
    </a>
  ) : (
    <button type="button" className={classes}>
      {children}
    </button>
  );
}
