import { cx } from "@/shared";
import { Mark } from "./Mark";
import { BRAND_LOGO } from "./logo-paths";
import styles from "./Logo.module.css";

interface LogoProps {
  /** header: 밝은 배경용(그라데이션 지원) · footer: 어두운 배경용 */
  tone?: "header" | "footer";
  className?: string;
}

/** WOOJOO STAY 워드마크. 색은 시안 토큰(--logo-*)을 따른다. */
export function Logo({ tone = "header", className }: LogoProps) {
  const isFooter = tone === "footer";
  return (
    <Mark
      paths={BRAND_LOGO}
      title="WOOJOO STAY"
      className={cx(styles.logo, className)}
      body={{ stops: isFooter ? ["var(--logo-footer)"] : ["var(--logo-1)", "var(--logo-2)", "var(--logo-3)"] }}
      star={{
        stops: isFooter
          ? ["var(--logo-footer-star)"]
          : ["var(--logo-star-1)", "var(--logo-star-2)", "var(--logo-star-3)"],
        opacity: isFooter ? "var(--logo-footer-star-opacity)" : "var(--logo-star-opacity)",
      }}
    />
  );
}
