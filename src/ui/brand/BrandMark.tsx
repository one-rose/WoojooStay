import { cx } from "@/shared";
import { Mark } from "./Mark";
import { DUO_MARK, ORB_MARK } from "./logo-paths";
import styles from "./BrandMark.module.css";

interface BrandMarkProps {
  className?: string;
}

const CURRENT = { stops: ["currentColor"] } as const;
const STAR = { stops: ["currentColor"], opacity: "var(--mark-star-opacity, .5)" } as const;

/** 로고의 'O' 한 글자 — 사이트 곳곳의 아이콘. 색은 color(currentColor)로 지정 */
export function OrbMark({ className }: BrandMarkProps) {
  return <Mark paths={ORB_MARK} body={CURRENT} star={STAR} className={cx(styles.mark, className)} />;
}

/** 'OO' 두 글자 마크 */
export function DuoMark({ className }: BrandMarkProps) {
  return <Mark paths={DUO_MARK} body={CURRENT} star={STAR} className={cx(styles.mark, className)} />;
}
