import { cx } from "@/shared";
import { BRAND_LOGO } from "./logo-paths";
import { Mark } from "./Mark";
import "./brand.css";

interface LogoProps {
  /** header: 밝은 배경용 · footer: 어두운 배경용 (색은 tokens.css 의 --logo* / --logo-footer*) */
  tone?: "header" | "footer";
  className?: string;
}

export function Logo({ tone = "header", className }: LogoProps) {
  const footer = tone === "footer";
  return (
    <Mark
      paths={BRAND_LOGO}
      title="WOOJOO STAY"
      className={cx("logo", className)}
      bodyFill={footer ? "var(--logo-footer)" : "var(--logo)"}
      starFill={footer ? "var(--logo-footer-star)" : "var(--logo-star)"}
      starOpacity={footer ? "var(--logo-footer-star-opacity)" : "var(--logo-star-opacity)"}
    />
  );
}
