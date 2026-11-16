"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ActionResult, NotificationItem, Property, PropertyType } from "@/core";
import { cx } from "@/shared";
import { Logo } from "@/ui/brand";
import { DemoBar, Icon } from "../components";
import { NAV_FOOTER, NAV_GROUPS, type NavItem } from "./nav-items";
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
  /** 서버 없이 배포한 체험 모드 — 맨 위에 안내 띠 */
  demo?: boolean;
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
  demo,
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
    if (base === "/app") return pathname === "/app";
    if (item.match) {
      // 다른 메뉴가 이 주소를 정확히 가리키면 그 메뉴만 선택 (채널 연동 vs 설정)
      const exact = [...NAV_GROUPS.flatMap((g) => g.items), ...NAV_FOOTER].some(
        (i) => i !== item && i.href === pathname,
      );
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
          <Link href="/app" aria-label="우주스테이 홈">
            <Logo tone="footer" className="pm-nav__logo" />
          </Link>
          <button type="button" className="pm-nav__close" onClick={() => setOpen(false)} aria-label="메뉴 닫기">
            <Icon name="close" />
          </button>
        </div>

        {/* 업장 전환은 업장이 둘 이상일 때 붙인다 — 지금은 이름만 보여준다 */}
        <div className="pm-property">
          <strong>{property.name}</strong>
          <small>
            {TYPE_LABEL[property.type]} {property.rooms}실
          </small>
        </div>

        <nav className="pm-nav__groups">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="pm-nav__group">
              <p className="pm-nav__group-label">{group.label}</p>
              <ul>{group.items.map(renderItem)}</ul>
            </div>
          ))}
        </nav>

        <ul className="pm-nav__foot">{NAV_FOOTER.map(renderItem)}</ul>
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
          <Link href="/app" className="pm-top__logo" aria-label="우주스테이 홈">
            <Logo className="pm-top__logo-svg" />
          </Link>
          <div className="pm-top__spacer" />
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
                  <strong>알림</strong>
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
                  {notifications.map((n) => (
                    <li key={n.id} className={cx("pm-bell__item", n.unread && !readIds.includes(n.id) && "is-unread")}>
                      <span className={cx("pm-bell__kind", `is-${n.kind}`)}>
                        <Icon name={BELL_ICON[n.kind]} size={15} />
                      </span>
                      <span className="pm-bell__text">
                        {n.text}
                        <small className="num">{n.at}</small>
                      </span>
                    </li>
                  ))}
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
                  <small>{property.name}</small>
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
