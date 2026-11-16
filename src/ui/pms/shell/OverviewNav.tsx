"use client";

import { useState, useTransition } from "react";
import type { PropertyOption, PropertyType, SwitchPropertyAction } from "@/core";
import { cx } from "@/shared";

const TYPE_LABEL: Record<PropertyType, string> = {
  hotel: "호텔",
  motel: "모텔",
  pension: "펜션",
  guesthouse: "게스트하우스",
};

interface OverviewNavProps {
  properties: readonly PropertyOption[];
  switchProperty: SwitchPropertyAction;
  onNavigate: () => void;
}

/**
 * 전체 현황에서의 사이드바 — 업장 하나에 딸린 메뉴(홈·리뷰 관리 …) 대신 업장 목록.
 * 어느 업장인지 고르지 않은 채 "홈"을 누르면 쿠키에 남은 업장이 열려 헷갈리므로,
 * 업장을 먼저 고르게 한다. 고르면 그 업장 홈으로.
 */
export function OverviewNav({ properties, switchProperty, onNavigate }: OverviewNavProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const open = (p: PropertyOption) => {
    if (isPending) return;
    setError("");
    setPendingId(p.id);
    startTransition(async () => {
      const r = await switchProperty(p.id, "/app");
      setPendingId(null);
      if (r && !r.ok) {
        setError(r.message);
        return;
      }
      onNavigate();
    });
  };

  return (
    <div className="pm-nav__group">
      <p className="pm-nav__group-label">업장 {properties.length}곳</p>
      <ul>
        {properties.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={cx("pm-nav__item pm-nav__prop", pendingId === p.id && "is-pending")}
              onClick={() => open(p)}
              disabled={isPending}
            >
              <span className="pm-nav__label">
                {p.name}
                <small>{pendingId === p.id ? "여는 중이에요" : `${TYPE_LABEL[p.type]} ${p.rooms}실`}</small>
              </span>
              {p.urgent && (
                <span className="pm-nav__dot" title="연동 끊김·결제 실패 등 확인이 필요해요">
                  <span className="pm-sr">확인 필요</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p className="pm-nav__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
