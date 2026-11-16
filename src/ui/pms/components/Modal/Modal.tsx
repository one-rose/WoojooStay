"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "../Icon/Icon";
import "./modal.css";

interface ModalProps {
  title: string;
  desc?: ReactNode;
  onClose: () => void;
  footer: ReactNode;
  wide?: boolean;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 대화 상자 — Esc·바깥 클릭으로 닫힘, Tab 은 상자 안에서만 돈다.
 * 열 때 첫 입력칸(없으면 아래쪽 주 버튼)에 포커스, 닫으면 연 버튼으로 포커스를 돌려준다.
 */
export function Modal({ title, desc, onClose, footer, wide, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  // 부모가 매번 새 함수를 넘겨도 효과가 다시 돌지 않게 (포커스를 뺏거나 다시 불러오지 않도록)
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const box = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = () =>
      box ? [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null) : [];

    const first =
      box?.querySelector<HTMLElement>("[data-autofocus]:not([disabled])") ??
      box?.querySelector<HTMLElement>(
        ".pm-modal__body input:not([disabled]):not([type=hidden]), .pm-modal__body select:not([disabled]), .pm-modal__body textarea:not([disabled])",
      ) ??
      box?.querySelector<HTMLElement>(
        ".pm-modal__foot .pm-btn--primary:not([disabled]), .pm-modal__foot .pm-btn--navy:not([disabled])",
      ) ??
      box;
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !box) return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        box.focus();
        return;
      }
      const a = list[0];
      const z = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === a || active === box)) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && active === z) {
        e.preventDefault();
        a.focus();
      } else if (!box.contains(active)) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <div className="pm-modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={wide ? "pm-modal__box pm-modal__box--wide" : "pm-modal__box"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={desc ? descId : undefined}
        tabIndex={-1}
        ref={ref}
      >
        <header className="pm-modal__head">
          <div>
            <h2 className="pm-modal__title" id={titleId}>
              {title}
            </h2>
            {desc && (
              <p className="pm-modal__desc" id={descId}>
                {desc}
              </p>
            )}
          </div>
          <button type="button" className="pm-modal__close" onClick={onClose} aria-label="닫기">
            <Icon name="close" />
          </button>
        </header>
        <div className="pm-modal__body">{children}</div>
        <footer className="pm-modal__foot">{footer}</footer>
      </div>
    </div>
  );
}
