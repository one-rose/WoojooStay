"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type {
  ActionResult,
  NotificationItem,
  Property,
  PropertyOption,
  PropertyType,
  ReadNotificationAction,
  SwitchPropertyAction,
} from "@/core";
import { cx } from "@/shared";
import { Logo } from "@/ui/brand";
import { DemoBar, Icon } from "../components";
import { NAV_FOOTER, NAV_GROUPS, NAV_INBOX, NAV_OVERVIEW, NAV_PEOPLE, NAV_REPORT, type NavItem } from "./nav-items";
import { OverviewNav } from "./OverviewNav";
import { PropertyPicker } from "./PropertyPicker";
import "./app-shell.css";

const BELL_ICON: Record<NotificationItem["kind"], "review" | "settle" | "alert" | "expense" | "staff"> = {
  review: "review",
  settle: "settle",
  sync: "alert",
  billing: "expense",
  staff: "staff",
};

const TYPE_LABEL: Record<PropertyType, string> = {
  hotel: "호텔",
  motel: "모텔",
  pension: "펜션",
  guesthouse: "게스트하우스",
};

interface AppShellProps {
  property: Property;
  unansweredReviews: number;
  /** 마지막 채널 수집 시각 "HH:mm" */
  lastSyncedAt: string;
  syncErrors: number;
  notifications: readonly NotificationItem[];
  /** 실서버 모드에서 로그아웃 경로 (POST) */
  logoutPath?: string;
  /** 로그인한 사람 */
  user?: { name: string; roleLabel: string };
  /** 알림 모두 읽음 (실서버) */
  readAllNotifications?: () => Promise<ActionResult>;
  /** 알림 한 건을 눌렀을 때 읽음으로 */
  readNotification?: ReadNotificationAction;
  /** 서버 없이 배포한 체험 모드 — 맨 위에 안내 띠 */
  demo?: boolean;
  /** 사장님·매니저인 업장 — 2곳 이상이면 업장 전환 · 전체 현황 메뉴 */
  properties?: readonly PropertyOption[];
  /** 업장 전부의 미답변 리뷰 수 (통합 리뷰함 메뉴) */
  portfolioUnanswered?: number;
  /** 업장을 바꾸고 보던 메뉴 그대로 그 업장 화면으로 */
  switchProperty?: SwitchPropertyAction;
  children: ReactNode;
}

/** "11.15 19:52" → "19:52" (날짜는 마우스를 올리면 보인다) */
function syncTime(at: string) {
  return at.split(" ").pop() ?? at;
}
/** "11.15 19:52" → "11월 15일 19:52" */
function syncLong(at: string) {
  const m = /^(\d{1,2})\.(\d{1,2}) (\d{1,2}:\d{2})$/.exec(at);
  return m ? `${Number(m[1])}월 ${Number(m[2])}일 ${m[3]}` : at;
}

/** 1100px 이하면 사이드바가 서랍 — 닫힌 서랍은 inert 로 Tab 이 들어가지 않게 */
const DRAWER_QUERY = "(max-width: 1100px)";
function useDrawerMode() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DRAWER_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DRAWER_QUERY).matches,
    () => false,
  );
}

export function AppShell({
  property,
  unansweredReviews,
  lastSyncedAt,
  syncErrors,
  notifications,
  logoutPath,
  user,
  readAllNotifications,
  readNotification,
  demo,
  properties = [],
  portfolioUnanswered = 0,
  switchProperty,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const drawer = useDrawerMode();
  const [open, setOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [bellError, setBellError] = useState("");
  const userBtn = useRef<HTMLButtonElement>(null);
  const multi = properties.length >= 2 && !!switchProperty;
  /** 전체 현황 · 통합 리뷰함 — 업장 하나가 아니라 업장 전부를 보는 화면 */
  const onOverview = pathname === "/app/overview" || pathname.startsWith("/app/overview/");
  const homeHref = multi ? "/app/overview" : "/app";
  const unread = notifications.filter((n) => n.unread && !readIds.includes(n.id)).length;

  const readAll = async () => {
    const prev = readIds;
    setReadIds(notifications.map((n) => n.id));
    setBellError("");
    if (!readAllNotifications) return;
    const r = await readAllNotifications();
    if (!r.ok) {
      setReadIds(prev);
      setBellError(r.message);
      return;
    }
    router.refresh();
  };

  /**
   * 알림을 누르면 그 화면으로. 여러 업장이면 그 업장으로 바꿔서 연다 —
   * 리뷰 알림은 업장을 바꾸지 않고 통합 리뷰함에서 그 업장 것만.
   */
  const openNotice = (n: NotificationItem) => {
    if (n.unread && !readIds.includes(n.id)) {
      setReadIds((prev) => [...prev, n.id]);
      void readNotification?.(n.id);
    }
    if (!n.link) return;
    setBellOpen(false);
    setOpen(false);
    if (multi && n.propertyId && switchProperty) {
      if (n.link.startsWith("/app/reviews") && !n.link.startsWith("/app/reviews/settings")) {
        const id = new URL(n.link, "http://x").searchParams.get("id");
        const q = new URLSearchParams({ property: n.propertyId, ...(id ? { id } : {}) });
        router.push(`/app/overview/reviews?${q}`);
        return;
      }
      if (n.propertyId !== property.id || onOverview) {
        void switchProperty(n.propertyId, n.link);
        return;
      }
    }
    router.push(n.link);
  };

  useEffect(() => {
    if (!userOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setUserOpen(false);
      userBtn.current?.focus();
    };
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".pm-usermenu")) setUserOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [userOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!bellOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBellOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".pm-bell")) setBellOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [bellOpen]);

  const isActive = (item: NavItem) => {
    const base = item.match ?? item.href;
    if (!base) return false;
    if (base === "/app" || item.exact) return pathname === base;
    if (item.match) {
      // 다른 메뉴가 이 주소를 정확히 가리키면 그 메뉴만 선택 (채널 연동 vs 설정)
      const exact = [
        NAV_OVERVIEW,
        NAV_INBOX,
        NAV_REPORT,
        NAV_PEOPLE,
        ...NAV_GROUPS.flatMap((g) => g.items),
        ...NAV_FOOTER,
      ].some((i) => i !== item && i.href === pathname);
      return !exact && pathname.startsWith(base);
    }
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  const renderItem = (item: NavItem) => {
    const body = (
      <>
        <Icon name={item.icon} size={18} className="pm-nav__icon" />
        <span className="pm-nav__label">{item.label}</span>
        {item.counter === "reviews" && unansweredReviews > 0 && (
          <span className="pm-nav__count num">{unansweredReviews}</span>
        )}
        {item.counter === "inbox" && portfolioUnanswered > 0 && (
          <span className="pm-nav__count num">{portfolioUnanswered}</span>
        )}
        {item.stage && <span className="pm-nav__stage">{item.stage}</span>}
      </>
    );
    if (!item.href) {
      return (
        <li key={item.label}>
          <span className="pm-nav__item pm-nav__item--soon" aria-disabled="true" title="준비 중인 메뉴입니다">
            {body}
          </span>
        </li>
      );
    }
    const active = isActive(item);
    return (
      <li key={item.label}>
        <Link
          href={item.href}
          className={cx("pm-nav__item", active && "is-active")}
          aria-current={active ? "page" : undefined}
          onClick={() => setOpen(false)}
        >
          {body}
        </Link>
      </li>
    );
  };

  return (
    <div className="pm-shell">
      <aside
        className={cx("pm-nav", open && "is-open")}
        id="pm-nav"
        aria-label="주 메뉴"
        inert={drawer && !open ? true : undefined}
      >
        <div className="pm-nav__brand">
          <Link href={homeHref} aria-label="우주스테이 홈">
            <Logo tone="footer" className="pm-nav__logo" />
          </Link>
          <button type="button" className="pm-nav__close" onClick={() => setOpen(false)} aria-label="메뉴 닫기">
            <Icon name="close" />
          </button>
        </div>

        {/* 업장이 2곳 이상이면 업장 이름이 전환 버튼 — 1곳이면 이름만 */}
        {multi ? (
          <PropertyPicker
            current={property}
            onOverview={onOverview}
            properties={properties}
            switchProperty={switchProperty}
            onNavigate={() => setOpen(false)}
          />
        ) : (
          <div className="pm-property">
            <strong>{property.name}</strong>
            <small>
              {TYPE_LABEL[property.type]} {property.rooms}실
            </small>
          </div>
        )}

        <nav className="pm-nav__groups">
          {multi && (
            <ul className="pm-nav__top">
              {renderItem(NAV_OVERVIEW)}
              {renderItem(NAV_INBOX)}
              {renderItem(NAV_REPORT)}
              {renderItem(NAV_PEOPLE)}
            </ul>
          )}
          {/* 전체 현황에서는 업장 하나에 딸린 메뉴 대신 업장 목록 — 어느 업장인지 먼저 고른다 */}
          {multi && onOverview && switchProperty ? (
            <OverviewNav properties={properties} switchProperty={switchProperty} onNavigate={() => setOpen(false)} />
          ) : (
            <>
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="pm-nav__group">
                  <p className="pm-nav__group-label">{group.label}</p>
                  <ul>{group.items.map(renderItem)}</ul>
                </div>
              ))}
            </>
          )}
        </nav>

        {!(multi && onOverview) && <ul className="pm-nav__foot">{NAV_FOOTER.map(renderItem)}</ul>}
      </aside>
      {open && <div className="pm-scrim" onClick={() => setOpen(false)} aria-hidden />}

      <div className="pm-main">
        {demo && <DemoBar current="/app" />}
        <header className="pm-top">
          <button
            type="button"
            className="pm-top__menu"
            onClick={() => setOpen(true)}
            aria-label="메뉴 열기"
            aria-expanded={open}
            aria-controls="pm-nav"
          >
            <Icon name="menu" />
          </button>
          <Link href={homeHref} className="pm-top__logo" aria-label="우주스테이 홈">
            <Logo className="pm-top__logo-svg" />
          </Link>
          <div className="pm-top__spacer" />
          {/* 채널 수집 시각은 업장 하나의 것 — 전체 현황에서는 숨긴다 */}
          {!(multi && onOverview) && (
            <span
              className={cx("pm-top__sync", syncErrors > 0 && "has-error")}
              title={`마지막 채널 수집 ${syncLong(lastSyncedAt)}`}
            >
              <Icon name={syncErrors > 0 ? "alert" : "sync"} size={15} />
              <span>
                {syncErrors > 0 ? `연동 오류 ${syncErrors}건` : "채널 수집"}{" "}
                <span className="num">{syncTime(lastSyncedAt)}</span>
              </span>
            </span>
          )}
          <div className="pm-bell">
            <button
              type="button"
              className="pm-top__icon"
              aria-label={`알림 ${unread}건`}
              aria-expanded={bellOpen}
              onClick={() => setBellOpen((v) => !v)}
            >
              <Icon name="bell" />
              {unread > 0 && <span className="pm-top__dot" aria-hidden />}
            </button>
            {bellOpen && (
              <div className="pm-bell__panel" role="dialog" aria-label="알림">
                <header className="pm-bell__head">
                  <strong>
                    알림
                    {multi && <small className="pm-bell__scope">업장 {properties.length}곳</small>}
                  </strong>
                  {unread > 0 && (
                    <button type="button" onClick={readAll}>
                      모두 읽음
                    </button>
                  )}
                </header>
                {bellError && (
                  <p className="pm-bell__error" role="alert">
                    {bellError}
                  </p>
                )}
                {notifications.length === 0 && <p className="pm-bell__empty">새 알림이 없어요.</p>}
                <ul>
                  {notifications.map((n) => {
                    const body = (
                      <>
                        <span className={cx("pm-bell__kind", `is-${n.kind}`)}>
                          <Icon name={BELL_ICON[n.kind]} size={15} />
                        </span>
                        <span className="pm-bell__text">
                          {multi && n.propertyName && <b className="pm-bell__property">{n.propertyName}</b>}
                          {n.text}
                          <small className="num">{n.at}</small>
                        </span>
                      </>
                    );
                    const unreadNow = n.unread && !readIds.includes(n.id);
                    return (
                      <li key={n.id} className={cx("pm-bell__item", unreadNow && "is-unread", n.link && "is-link")}>
                        {n.link ? (
                          <button type="button" className="pm-bell__go" onClick={() => openNotice(n)}>
                            {body}
                          </button>
                        ) : (
                          body
                        )}
                      </li>
                    );
                  })}
                </ul>
                <Link href="/app/settings/notifications" className="pm-bell__foot" onClick={() => setBellOpen(false)}>
                  알림 설정
                </Link>
              </div>
            )}
          </div>
          <div className="pm-usermenu">
            <button
              type="button"
              ref={userBtn}
              className="pm-top__user"
              aria-label={`${user?.name ?? "내 계정"} 메뉴`}
              aria-expanded={userOpen}
              aria-haspopup="true"
              onClick={() => setUserOpen((v) => !v)}
            >
              {(user?.name ?? "나").slice(0, 1)}
            </button>
            {userOpen && (
              <div className="pm-usermenu__panel">
                <p className="pm-usermenu__who">
                  <strong>{user?.name ?? "사장님"}</strong>
                  <small>{onOverview && multi ? `전체 업장 ${properties.length}곳` : property.name}</small>
                  {user?.roleLabel && <small>{user.roleLabel}</small>}
                </p>
                <Link href="/app/settings/property" className="pm-usermenu__item" onClick={() => setUserOpen(false)}>
                  <Icon name="settings" size={16} />
                  설정
                </Link>
                {logoutPath && (
                  <form action={logoutPath} method="post">
                    <button type="submit" className="pm-usermenu__item">
                      <Icon name="logout" size={16} />
                      로그아웃
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </header>
        <main className="pm-content">{children}</main>
      </div>
    </div>
  );
}
