"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Property, PropertyOption, PropertyType, SwitchPropertyAction } from "@/core";
import { cx } from "@/shared";
import { Icon } from "../components";
import "./property-picker.css";

const TYPE_LABEL: Record<PropertyType, string> = {
  hotel: "호텔",
  motel: "모텔",
  pension: "펜션",
  guesthouse: "게스트하우스",
};

/** 업장 5곳 이상이면 검색 칸 */
const SEARCH_FROM = 5;

interface PropertyPickerProps {
  current: Property;
  /** 지금 전체 현황 화면 */
  onOverview: boolean;
  properties: readonly PropertyOption[];
  switchProperty: SwitchPropertyAction;
  /** 고른 뒤 (서랍 닫기) */
  onNavigate: () => void;
  /** 처음부터 목록을 펼친 채로 (모바일 상단 업장 이름을 눌러 열었을 때) */
  defaultOpen?: boolean;
}

/**
 * 사이드바 맨 위 업장 전환 (F8) — 맨 위 "전체 현황", 그 아래 업장들(급한 문제가 있으면 빨간 점).
 * 업장을 고르면 지금 보던 메뉴 그대로 그 업장 화면을 연다.
 */
export function PropertyPicker({
  current,
  onOverview,
  properties,
  switchProperty,
  onNavigate,
  defaultOpen = false,
}: PropertyPickerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "");
    if (!q) return properties;
    return properties.filter((p) => p.name.toLowerCase().replace(/\s+/g, "").includes(q));
  }, [properties, query]);
  const urgentCount = properties.filter((p) => p.urgent).length;

  const close = (focusButton = true) => {
    setOpen(false);
    setQuery("");
    if (focusButton) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    window.addEventListener("mousedown", onDown);
    // 열리면 검색 칸(없으면 지금 업장)에 포커스
    const t = window.setTimeout(() => {
      if (searchRef.current) searchRef.current.focus();
      else rootRef.current?.querySelector<HTMLElement>(".pm-picker__opt.is-current, .pm-picker__opt")?.focus();
    }, 0);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.clearTimeout(t);
    };
  }, [open]);

  /** 위·아래 화살표로 항목 이동, Esc 로 닫기 */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const opts = [...(rootRef.current?.querySelectorAll<HTMLElement>(".pm-picker__opt") ?? [])];
    if (!opts.length) return;
    e.preventDefault();
    const i = opts.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % opts.length : i <= 0 ? opts.length - 1 : i - 1;
    opts[next].focus();
  };

  const pick = (p: PropertyOption) => {
    if (isPending) return;
    if (p.id === current.id && !onOverview) {
      close();
      return;
    }
    setError("");
    setPendingId(p.id);
    startTransition(async () => {
      const r = await switchProperty(p.id, pathname);
      if (r && !r.ok) {
        setError(r.message);
        setPendingId(null);
        return;
      }
      setPendingId(null);
      setOpen(false);
      setQuery("");
      onNavigate();
    });
  };

  const goOverview = () => {
    close(false);
    onNavigate();
    router.push("/app/overview");
  };

  return (
    <div className={cx("pm-picker", open && "is-open")} ref={rootRef} onKeyDown={open ? onKeyDown : undefined}>
      <button
        type="button"
        ref={buttonRef}
        className="pm-picker__btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="pm-picker__now">
          {onOverview ? (
            <>
              <strong>전체 현황</strong>
              <small>업장 {properties.length}곳</small>
            </>
          ) : (
            <>
              <strong>{current.name}</strong>
              <small>
                {TYPE_LABEL[current.type]} {current.rooms}실
              </small>
            </>
          )}
        </span>
        {urgentCount > 0 && !open && (
          <span className="pm-picker__flag" aria-label={`확인이 필요한 업장 ${urgentCount}곳`} />
        )}
        <Icon name="chevronDown" size={16} className="pm-picker__caret" />
      </button>

      {open && (
        <div className="pm-picker__panel" id={listId} role="dialog" aria-label="업장 바꾸기">
          {properties.length >= SEARCH_FROM && (
            <div className="pm-picker__search">
              <Icon name="search" size={15} />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="업장 이름 검색"
                aria-label="업장 이름 검색"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filtered.length === 1) pick(filtered[0]);
                }}
              />
            </div>
          )}
          <ul className="pm-picker__list">
            <li>
              <button
                type="button"
                className={cx("pm-picker__opt pm-picker__opt--all", onOverview && "is-current")}
                aria-current={onOverview ? "page" : undefined}
                onClick={goOverview}
              >
                <Icon name="grid" size={16} className="pm-picker__all-icon" />
                <span className="pm-picker__text">
                  <strong>전체 현황</strong>
                  <small>업장 {properties.length}곳 한눈에</small>
                </span>
                {onOverview && <Icon name="check" size={16} className="pm-picker__check" />}
              </button>
            </li>
          </ul>
          <p className="pm-picker__label">업장</p>
          <ul className="pm-picker__list pm-picker__list--scroll">
            {filtered.map((p) => {
              const selected = p.id === current.id && !onOverview;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={cx("pm-picker__opt", selected && "is-current", pendingId === p.id && "is-pending")}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => pick(p)}
                  >
                    <span className="pm-picker__text">
                      <strong>{p.name}</strong>
                      <small>{pendingId === p.id ? "여는 중이에요" : `${TYPE_LABEL[p.type]} ${p.rooms}실`}</small>
                    </span>
                    {p.urgent && (
                      <span className="pm-picker__dot" title="연동 끊김·결제 실패 등 확인이 필요해요">
                        <span className="pm-sr">확인 필요</span>
                      </span>
                    )}
                    {selected && <Icon name="check" size={16} className="pm-picker__check" />}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="pm-picker__empty">‘{query}’ 업장이 없어요.</li>}
          </ul>
          {error && (
            <p className="pm-picker__error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
