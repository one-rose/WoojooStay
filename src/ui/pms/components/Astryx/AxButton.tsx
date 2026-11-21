"use client";

import { Button, type ButtonVariant } from "@astryxdesign/core/Button";
import Link from "next/link";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { cx } from "@/shared";
import { Icon, type IconName } from "../Icon/Icon";

type Variant = "brand" | "primary" | "navy" | "ghost" | "quiet" | "alert";

interface AxButtonProps {
  /** PmButton 과 같은 종류 — brand(대표 · 주황) · primary/navy(남색) · ghost(흰 바탕 + 선) · quiet(글자만) · alert(빨간 선) */
  variant?: Variant;
  size?: "md" | "sm";
  icon?: IconName;
  iconSwap?: boolean;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** 진행 중 — 눌러도 다시 보내지 않는다 (아스트릭스 isLoading) */
  loading?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
  "aria-label"?: string;
  autoFocus?: boolean;
  children: ReactNode;
}

const VARIANT: Record<Variant, ButtonVariant> = {
  brand: "primary",
  primary: "primary",
  navy: "primary",
  ghost: "secondary",
  quiet: "ghost",
  alert: "secondary",
};

/** 화면에 보이는 글자 그대로 — 아스트릭스 Button 은 label(접근 이름)이 꼭 있어야 한다 */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node as ReactElement<{ children?: ReactNode }>).props.children);
  return Children.toArray(node).map(textOf).join("");
}

/**
 * 버튼 — 로그인 · 관리자 화면용 아스트릭스 버튼 (PmButton 과 같은 props 라 이름만 바꿔 쓴다).
 * 모양은 우리 토큰: 알약 · 남색 주 버튼 · 대표 버튼만 주황 (astryx-theme.css).
 */
export function AxButton({
  variant = "ghost",
  size = "md",
  icon,
  iconSwap,
  href,
  onClick,
  disabled,
  loading,
  type = "button",
  className,
  title,
  autoFocus,
  children,
  ...rest
}: AxButtonProps) {
  const label = rest["aria-label"] ?? textOf(children);
  const external = href ? /^(https?:|mailto:|tel:)/.test(href) : false;
  return (
    <Button
      label={label}
      variant={VARIANT[variant]}
      size={size === "sm" ? "md" : "lg"}
      type={type}
      isDisabled={disabled}
      isLoading={loading}
      onClick={onClick}
      href={href}
      as={href && !external ? Link : undefined}
      target={external && href?.startsWith("http") ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      tooltip={title}
      icon={icon ? <Icon name={icon} size={size === "sm" ? 15 : 16} swap={iconSwap} /> : undefined}
      className={cx("ax-btn", `ax-btn--${variant}`, className)}
      data-autofocus={autoFocus ? "" : undefined}
    >
      {children}
    </Button>
  );
}
