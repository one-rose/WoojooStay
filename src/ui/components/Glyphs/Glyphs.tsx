import { Fragment } from "react";
import { cx } from "@/shared";

/** 금액 앞의 작은 ₩ */
export function Won() {
  return <span className="won">₩</span>;
}

/** 문장 속 오른쪽 화살표 */
export function Arrow({ className }: { className?: string }) {
  return (
    <svg className={cx("arrow", className)} viewBox="0 0 20 16" aria-hidden="true">
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

/** "A → B → C" 흐름 문장 */
export function ArrowFlow({ parts }: { parts: readonly string[] }) {
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <>
              {" "}
              <Arrow />{" "}
            </>
          )}
          {part}
        </Fragment>
      ))}
    </>
  );
}

const STROKE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** 로드맵 단계 아이콘 (선 아이콘) */
export function StepIcon({ name }: { name: "book" | "wallet" | "people" | "receipt" }) {
  return (
    <svg {...STROKE} strokeWidth="1.6">
      {name === "book" && (
        <>
          <path d="M12 6.5C10.5 5.3 8.3 4.8 5 5v12.5c3.3-.2 5.5.3 7 1.5 1.5-1.2 3.7-1.7 7-1.5V5c-3.3-.2-5.5.3-7 1.5Z" />
          <path d="M12 6.5V19" />
        </>
      )}
      {name === "wallet" && (
        <>
          <rect x="4" y="6.5" width="16" height="11.5" rx="2.5" />
          <path d="M20 10.5h-4.5a2 2 0 0 0 0 4H20" />
          <circle cx="15.8" cy="12.5" r=".4" fill="currentColor" />
        </>
      )}
      {name === "people" && (
        <>
          <circle cx="9" cy="8.5" r="2.5" />
          <circle cx="16" cy="9.5" r="2" />
          <path d="M4.5 18c.3-2.7 2.2-4.3 4.5-4.3s4.2 1.6 4.5 4.3M14 14.2c.6-.3 1.3-.5 2-.5 1.9 0 3.3 1.3 3.6 3.3" />
        </>
      )}
      {name === "receipt" && (
        <>
          <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-2.2-1.5L13.6 20 12 18.5 10.4 20l-2.2-1.5L6 20V5.5a1 1 0 0 1 1-1Z" />
          <path d="M9 9h6M9 12.5h6" />
        </>
      )}
    </svg>
  );
}

const PROPERTY_ICON_PATHS = {
  hotel: [
    "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16",
    "M15 10h4a1 1 0 0 1 1 1v10",
    "M3 21h18",
    "M8 8h3M8 12h3M8 16h3",
    "M17.5 14h.01M17.5 17h.01",
  ],
  motel: [
    "M3 18V8",
    "M3 13h18v5",
    "M21 18v-3a3 3 0 0 0-3-3h-7v1",
    "M7 12.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z",
    "M17.5 2.5a2.2 2.2 0 0 0 3 3 2.6 2.6 0 1 1-3-3Z",
  ],
  pension: ["M3 11 12 4l9 7", "M5 9.5V20h14V9.5", "M10 20v-5h4v5", "M16 6V3.5h2.5V8"],
  guesthouse: [
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    "M3 12h18",
    "M12 3c2.5 2.5 3.6 5.6 3.6 9s-1.1 6.5-3.6 9c-2.5-2.5-3.6-5.6-3.6-9S9.5 5.5 12 3Z",
  ],
} as const;

/** 숙박 유형 아이콘 (호텔·모텔·펜션·게스트하우스) */
export function PropertyIcon({ type, className }: { type: keyof typeof PROPERTY_ICON_PATHS; className?: string }) {
  return (
    <svg {...STROKE} strokeWidth="1.8" className={className}>
      {PROPERTY_ICON_PATHS[type].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
