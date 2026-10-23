import { cx } from "@/shared";
import { DUO_MARK, ORB_MARK } from "./logo-paths";
import { Mark } from "./Mark";
import "./brand.css";

/** 오브 마크(O + 별) — 아이콘·불릿으로 쓰인다. 색은 currentColor */
export function OrbMark({ className }: { className?: string }) {
  return <Mark paths={ORB_MARK} className={cx("orb", className)} />;
}

/** 듀오 마크(OO) */
export function DuoMark({ className }: { className?: string }) {
  return <Mark paths={DUO_MARK} className={cx("duo", className)} />;
}
