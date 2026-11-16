/** 앱 아이콘 — 24 격자, 1.75 선 굵기. 색은 currentColor */
const PATHS = {
  home: "M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z",
  review: "M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5",
  rates: "M4 5h16v15H4zM4 10h16M9 5v15M14.5 5v15",
  ledger: "M5 4h11l3 3v13H5zM8.5 10h7M8.5 13.5h7M8.5 17h4",
  settle: "M3.5 7h17v11h-17zM3.5 10.5h17M7 14.5h3",
  advance: "M12 3v18M16.5 7.5C16.5 5.6 14.5 5 12 5s-4.5 1-4.5 3 2 2.6 4.5 3 4.5 1 4.5 3-2 3-4.5 3-4.5-.6-4.5-2.5",
  staff:
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.5a3.3 3.3 0 0 1 0 6.4M18 14.8c1.9.7 3.2 2.5 3.5 5.2",
  expense: "M6 3.5h12v17l-3-2-3 2-3-2-3 2zM9 8.5h6M9 12h6",
  link: "M10 14a4 4 0 0 0 5.7 0l3.2-3.2a4 4 0 0 0-5.7-5.7L12 6.3M14 10a4 4 0 0 0-5.7 0l-3.2 3.2a4 4 0 0 0 5.7 5.7l1.2-1.2",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2 1.2L14.8 21h-4l-.3-2.4a7 7 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2.4L4.6 9.9l2-3.4 1.9.7a7 7 0 0 1 2-1.2L10.8 3.5h4l.3 2.5a7 7 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2.4z",
  bell: "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  chevron: "m9 6 6 6-6 6",
  chevronLeft: "m15 6-6 6 6 6",
  chevronDown: "m6 9 6 6 6-6",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  logout: "M14 4.5h4.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H14M10 16.5 5.5 12 10 7.5M5.5 12H15",
  download: "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14",
  check: "m5 12.5 4.5 4.5L19 7.5",
  alert: "M12 4 21 19.5H3zM12 10v4.5M12 17.2v.3",
  sync: "M19.5 9A7.5 7.5 0 0 0 6 6.5L4.5 8M4.5 4v4h4M4.5 15A7.5 7.5 0 0 0 18 17.5l1.5-1.5M19.5 20v-4h-4",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  derived: "M7 4v6a4 4 0 0 0 4 4h8M15.5 10.5 19 14l-3.5 3.5",
  lock: "M6.5 10.5h11v9.5h-11zM8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5",
  calendar: "M4 6h16v14H4zM4 10h16M8.5 3.5v4M15.5 3.5v4",
  undo: "M9 14 4.5 9.5 9 5M5 9.5h9a5.5 5.5 0 0 1 0 11h-3",
  photo: "M4 6h16v13H4zM4 15.5l4.5-4 4 3.5 3-2.5 4.5 4M15.5 10.5a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z",
  door: "M6 20.5V4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16M3.5 20.5h17M14.5 12.5v.5",
  pin: "M9 3.5h6M10 3.5v6l-3 3.5h10l-3-3.5v-6M12 13v7.5",
  history: "M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9M4.5 4.5V9H9M12 8v4.5l3 2",
  plus: "M12 5v14M5 12h14",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  trash: "M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14M10 10.5v6.5M14 10.5v6.5",
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
}

export function Icon({ name, size = 18, className, title }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
