"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { cx } from "@/shared";
import { readScheme, subscribeScheme, writeScheme } from "../scheme-store";
import styles from "./SchemeSwitcher.module.css";

/** 전환 버튼에 필요한 시안 정보 (서버 → 클라이언트로 넘기는 직렬화 가능한 값) */
export interface SchemeOption {
  id: string;
  code: string;
  name: string;
  description: string;
  swatch: readonly [string, string, string];
}

interface SchemeSwitcherProps {
  options: readonly SchemeOption[];
  defaultId: string;
}

/**
 * 화면 하단에 떠 있는 칼라 시안 전환 버튼.
 * 시안이 확정되면 NEXT_PUBLIC_SCHEME_SWITCHER=off 로 숨긴다.
 */
export function SchemeSwitcher({ options, defaultId }: SchemeSwitcherProps) {
  const currentId = useSyncExternalStore(
    subscribeScheme,
    () => readScheme() ?? defaultId,
    () => defaultId,
  );
  const index = Math.max(
    0,
    options.findIndex((option) => option.id === currentId),
  );
  const current = options[index];
  const next = options[(index + 1) % options.length];

  const step = useCallback(
    (delta: number) => writeScheme(options[(index + delta + options.length) % options.length].id),
    [index, options],
  );

  // ← → 방향키로도 전환
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      if (/^(input|textarea|select)$/i.test((event.target as HTMLElement).tagName)) return;
      step(event.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  return (
    <div className={styles.switcher} role="group" aria-label="칼라 시안 전환">
      <div className={styles.dots}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={cx(styles.dot, option.id === current.id && styles.active)}
            onClick={() => writeScheme(option.id)}
            aria-pressed={option.id === current.id}
            aria-label={`${option.code} 시안 · ${option.name}`}
            title={`${option.code} · ${option.name}`}
          >
            <i
              style={{
                background: `conic-gradient(${option.swatch[0]} 0 50%, ${option.swatch[1]} 0 75%, ${option.swatch[2]} 0)`,
              }}
            />
            <span>{option.code}</span>
          </button>
        ))}
      </div>
      <div className={styles.info} aria-live="polite">
        <strong>
          {current.code === "원본" ? "원본 시안" : `${current.code}안`} · {current.name}
        </strong>
        <span>{current.description}</span>
      </div>
      <button type="button" className={styles.next} onClick={() => writeScheme(next.id)}>
        시안 바꾸기
        <svg viewBox="0 0 20 16" aria-hidden="true">
          <path
            d="M1 8h16M11 2l7 6-7 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
