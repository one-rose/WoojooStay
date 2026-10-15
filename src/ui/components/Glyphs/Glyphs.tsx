import type { ReactNode } from "react";
import type { RoadmapIconId } from "@/core";
import styles from "./Glyphs.module.css";

/** 원화 기호 (숫자보다 작게) */
export function WonSign({ className }: { className?: string }) {
  return <span className={className ?? styles.won}>₩</span>;
}

/** 문장 속 오른쪽 화살표 */
export function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 20 16" aria-hidden="true">
      <path
        d="M1 8h16M11 2l7 6-7 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 조각들을 화살표로 잇는다: ["리뷰", "정산"] → 리뷰 → 정산 */
export function ArrowFlow({ parts }: { parts: readonly string[] }) {
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && (
            <>
              {" "}
              <Arrow />{" "}
            </>
          )}
          {part}
        </span>
      ))}
    </>
  );
}

const LINE_ICON_PATHS: Record<Exclude<RoadmapIconId, "brand">, ReactNode> = {
  book: (
    <>
      <path d="M12 6.5C10.5 5.3 8.3 4.8 5 5v12.5c3.3-.2 5.5.3 7 1.5 1.5-1.2 3.7-1.7 7-1.5V5c-3.3-.2-5.5.3-7 1.5Z" />
      <path d="M12 6.5V19" />
    </>
  ),
  wallet: (
    <>
      <rect x="4" y="6.5" width="16" height="11.5" rx="2.5" />
      <path d="M20 10.5h-4.5a2 2 0 0 0 0 4H20" />
      <circle cx="15.8" cy="12.5" r=".4" fill="currentColor" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.5" r="2.5" />
      <circle cx="16" cy="9.5" r="2" />
      <path d="M4.5 18c.3-2.7 2.2-4.3 4.5-4.3s4.2 1.6 4.5 4.3M14 14.2c.6-.3 1.3-.5 2-.5 1.9 0 3.3 1.3 3.6 3.3" />
    </>
  ),
  receipt: (
    <>
      <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-2.2-1.5L13.6 20 12 18.5 10.4 20l-2.2-1.5L6 20V5.5a1 1 0 0 1 1-1Z" />
      <path d="M9 9h6M9 12.5h6" />
    </>
  ),
};

/** 로드맵 카드 등에 쓰는 선 아이콘 */
export function LineIcon({ name, className }: { name: Exclude<RoadmapIconId, "brand">; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {LINE_ICON_PATHS[name]}
    </svg>
  );
}
