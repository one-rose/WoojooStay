import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/shared";
import { Icon, type IconName } from "../Icon/Icon";
import "./pm-button.css";

interface PmButtonProps {
  /** primary: 남색 단색 주 동작 (화면당 1개) · navy: primary 와 같은 모양(예전 이름) · ghost: 흰 바탕 + 선 · quiet: 글자만 */
  variant?: "primary" | "navy" | "ghost" | "quiet";
  size?: "md" | "sm";
  icon?: IconName;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  /** 누를 수 없는 이유 등 (마우스를 올리면 보임) */
  title?: string;
  "aria-label"?: string;
  /** 대화 상자가 열릴 때 이 버튼에 먼저 포커스 (Modal 이 읽는다) */
  autoFocus?: boolean;
  children: ReactNode;
}

export function PmButton({
  variant = "ghost",
  size = "md",
  icon,
  href,
  onClick,
  disabled,
  type = "button",
  className,
  title,
  autoFocus,
  children,
  ...rest
}: PmButtonProps) {
  const classes = cx("pm-btn", `pm-btn--${variant}`, size === "sm" && "pm-btn--sm", className);
  const inner = (
    <>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 16} />}
      <span>{children}</span>
    </>
  );
  if (href && !disabled) {
    // 앱 안 이동은 next/link (화면 전체를 다시 불러오지 않음), 바깥 주소는 새 창
    if (/^(https?:|mailto:|tel:)/.test(href)) {
      return (
        <a
          href={href}
          className={classes}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          title={title}
          aria-label={rest["aria-label"]}
        >
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} title={title} aria-label={rest["aria-label"]} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={rest["aria-label"]}
      data-autofocus={autoFocus ? "" : undefined}
    >
      {inner}
    </button>
  );
}
