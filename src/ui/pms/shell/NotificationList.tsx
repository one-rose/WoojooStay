"use client";

import { useEffect, useState } from "react";
import type { NotificationItem } from "@/core";
import { cx } from "@/shared";
import { Icon } from "../components";

const BELL_ICON: Record<NotificationItem["kind"], "review" | "settle" | "alert" | "expense" | "staff" | "calendar"> = {
  summary: "calendar",
  review: "review",
  settle: "settle",
  sync: "alert",
  billing: "expense",
  staff: "staff",
};

type Section = "urgent" | "review" | "etc";
const SECTION_LABEL: Record<Section, string> = { urgent: "급한 일", review: "리뷰", etc: "그 밖" };

/** 같은 업장 · 같은 종류가 여러 건이면 한 줄로 묶을 때의 이름 */
const GROUP_LABEL: Record<NotificationItem["kind"], string> = {
  review: "새 리뷰 알림",
  settle: "정산 알림",
  sync: "연동 알림",
  billing: "결제 알림",
  staff: "근무 알림",
  summary: "아침 요약",
};

/** 급한 일 — 연동 끊김 · 결제 실패 · 낮은 별점(확인 필요) 리뷰 · 퇴근 누락·근무자 없음 */
export function noticeSection(n: NotificationItem): Section {
  if (n.kind === "sync" || n.kind === "billing") return "urgent";
  if (n.kind === "review") return /별점|확인이 필요/.test(n.text) ? "urgent" : "review";
  if (n.kind === "staff" && /누락|빠진|없어요/.test(n.text)) return "urgent";
  return "etc";
}

/**
 * 알림을 눌렀을 때 열 화면 — 낮은 별점·확인 필요 리뷰 알림(첫 수집 포함)은 그 리뷰들이 먼저 보이게 "낮은 별점" 분류로.
 * 특정 리뷰(?id=)를 가리키면 그대로.
 */
export function noticeLink(n: NotificationItem): string {
  const link = n.link ?? "";
  if (n.kind !== "review" || !/별점|확인이 필요/.test(n.text)) return link;
  if (!/^\/app\/reviews(\?|$)/.test(link) || /[?&](id|tab)=/.test(link)) return link;
  return link.includes("?") ? `${link}&tab=low` : `${link}?tab=low`;
}

interface Group {
  key: string;
  section: Section;
  items: NotificationItem[];
}

function groupNotices(list: readonly NotificationItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const n of list) {
    const section = noticeSection(n);
    const key = `${section}|${n.propertyId ?? ""}|${n.kind}`;
    const g = map.get(key);
    if (g) g.items.push(n);
    else map.set(key, { key, section, items: [n] });
  }
  return [...map.values()];
}

/** "11.20 16:18" → 그 시각 (한국 시간, 올해 — 앞으로의 달이면 작년) */
function parseAt(at: string, now: Date): number | null {
  const m = /^(\d{1,2})\.(\d{1,2}) (\d{1,2}):(\d{2})$/.exec(at.trim());
  if (!m) return null;
  const kstNow = new Date(now.getTime() + 9 * 3_600_000);
  let year = kstNow.getUTCFullYear();
  if (Number(m[1]) > kstNow.getUTCMonth() + 1) year -= 1;
  return Date.UTC(year, Number(m[1]) - 1, Number(m[2]), Number(m[3]) - 9, Number(m[4]));
}

/** 어제 22시(한국 시간) */
function lastNight(now: Date): number {
  const kst = new Date(now.getTime() + 9 * 3_600_000);
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - 1, 22 - 9, 0);
}

interface NotificationListProps {
  notifications: readonly NotificationItem[];
  /** 이 화면에서 방금 읽은 알림 */
  readIds: readonly string[];
  /** 여러 업장 — 업장 이름을 붙인다 */
  multi: boolean;
  /** 알림(묶음이면 가장 최근 것)을 눌렀을 때 — 묶음의 나머지는 함께 읽음으로 */
  onOpen: (n: NotificationItem, alsoRead: readonly NotificationItem[]) => void;
}

/** 알림 창 목록 — 급한 일 / 리뷰 / 그 밖으로 나누고, 같은 업장 같은 종류는 한 줄로 */
export function NotificationList({ notifications, readIds, multi, onOpen }: NotificationListProps) {
  // 지금 시각은 브라우저에서만 (서버 렌더와 어긋나지 않게)
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setNow(new Date()), 0);
    return () => window.clearTimeout(t);
  }, []);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const groups = groupNotices(notifications);
  const isUnread = (n: NotificationItem) => n.unread && !readIds.includes(n.id);

  const since = now ? lastNight(now) : null;
  const overnight =
    now && since !== null
      ? notifications.filter((n) => noticeSection(n) === "urgent" && (parseAt(n.at, now) ?? 0) >= since).length
      : 0;

  const row = (n: NotificationItem, opts: { title?: string; count?: number; rest?: NotificationItem[] } = {}) => {
    const unread = isUnread(n) || (opts.rest ?? []).some(isUnread);
    const body = (
      <>
        <span className={cx("pm-bell__kind", `is-${n.kind}`)}>
          <Icon name={BELL_ICON[n.kind]} size={15} />
        </span>
        <span className="pm-bell__text">
          {multi && n.propertyName && <b className="pm-bell__property">{n.propertyName}</b>}
          {opts.title ? (
            <>
              <span className="pm-bell__group">
                {opts.title} <span className="num">{opts.count}</span>건
              </span>
              <span className="pm-bell__latest">{n.text}</span>
            </>
          ) : (
            n.text
          )}
          <small className="num">{n.at}</small>
        </span>
      </>
    );
    return (
      <li
        key={n.id}
        className={cx(
          "pm-bell__item",
          unread && "is-unread",
          n.link && "is-link",
          n.kind === "summary" && "is-summary",
        )}
      >
        {n.link ? (
          <button type="button" className="pm-bell__go" onClick={() => onOpen(n, opts.rest ?? [])}>
            {body}
          </button>
        ) : (
          body
        )}
      </li>
    );
  };

  const sections: Section[] = ["urgent", "review", "etc"];
  return (
    <>
      {overnight > 0 && (
        <p className="pm-bell__overnight" role="status">
          <Icon name="alert" size={14} />
          밤사이(어제 22시 이후) 급한 일 <b className="num">{overnight}</b>건
        </p>
      )}
      <div className="pm-bell__scroll">
        {sections.map((section) => {
          const list = groups.filter((g) => g.section === section);
          if (list.length === 0) return null;
          return (
            <section key={section} className="pm-bell__section" aria-label={SECTION_LABEL[section]}>
              <h3 className="pm-bell__section-title">{SECTION_LABEL[section]}</h3>
              <ul>
                {list.map((g) => {
                  const [latest, ...rest] = g.items;
                  if (rest.length === 0) return row(latest);
                  const expanded = openKeys.includes(g.key);
                  return [
                    row(latest, {
                      title:
                        section === "urgent" && latest.kind === "review"
                          ? "확인할 리뷰 알림"
                          : GROUP_LABEL[latest.kind],
                      count: g.items.length,
                      rest,
                    }),
                    <li key={`${g.key}-more`} className="pm-bell__more">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setOpenKeys((k) => (expanded ? k.filter((x) => x !== g.key) : [...k, g.key]))}
                      >
                        {expanded ? "접기" : `${rest.length}건 더 보기`}
                      </button>
                    </li>,
                    ...(expanded ? rest.map((n) => row(n)) : []),
                  ];
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
