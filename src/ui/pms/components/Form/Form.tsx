"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { cx } from "@/shared";
import "./form.css";

interface FieldProps {
  label: string;
  hint?: ReactNode;
  required?: boolean;
  /** row: 라벨 왼쪽 · 입력 오른쪽 (설정 화면) */
  layout?: "stack" | "row";
  children: ReactNode;
}

const LABELABLE = new Set(["input", "select", "textarea"]);
type ControlProps = { id?: string; "aria-describedby"?: string; "aria-required"?: boolean };

/**
 * 입력칸 + 이름표
 * - 자식이 입력칸 하나면 <label htmlFor> 로 바로 연결
 * - 여러 개(라디오 묶음, 입력칸 + 버튼 …)면 role="group" 으로 묶고, 안의 입력칸 하나에 이름표를 연결
 */
export function Field({ label, hint, required, layout = "stack", children }: FieldProps) {
  const base = useId();
  const controlId = `${base}-c`;
  const labelId = `${base}-l`;
  const hintId = `${base}-h`;
  const boxRef = useRef<HTMLDivElement>(null);

  const only =
    Children.count(children) === 1 && isValidElement(children) ? (children as ReactElement<ControlProps>) : null;
  const direct = only && typeof only.type === "string" && LABELABLE.has(only.type) ? only : null;
  const id = direct?.props.id ?? controlId;

  // 묶음일 때: 이름 없는 입력칸(라디오·체크박스 제외)이 하나면 그 칸에 이름표를 잇고,
  // 라디오·체크박스·여러 칸 묶음이면 묶음 전체를 role="group" 으로 이름 붙인다
  useEffect(() => {
    const box = boxRef.current;
    if (direct || !box) return;
    const inputs = [
      ...box.querySelectorAll<HTMLElement>(
        "input:not([type=radio]):not([type=checkbox]):not([type=hidden]), select, textarea",
      ),
    ].filter((el) => {
      const by = el.getAttribute("aria-labelledby");
      return !el.hasAttribute("aria-label") && (by === null || by === labelId);
    });
    const choices = box.querySelectorAll("input[type=radio], input[type=checkbox]").length;
    if (inputs.length === 1 && choices === 0) {
      inputs[0].setAttribute("aria-labelledby", labelId);
      if (hint) inputs[0].setAttribute("aria-describedby", hintId);
      box.removeAttribute("role");
      box.removeAttribute("aria-labelledby");
    } else {
      box.setAttribute("role", "group");
      box.setAttribute("aria-labelledby", labelId);
    }
  });

  const describedBy = hint ? hintId : undefined;

  return (
    <div className={cx("pm-field", layout === "row" && "pm-field--row")}>
      {direct ? (
        <label className="pm-field__label" htmlFor={id} id={labelId}>
          {label}
          {required && <em aria-hidden> *</em>}
        </label>
      ) : (
        <span className="pm-field__label" id={labelId}>
          {label}
          {required && <em aria-hidden> *</em>}
        </span>
      )}
      <div className="pm-field__control" ref={boxRef}>
        {direct
          ? cloneElement(direct, {
              id,
              "aria-describedby": direct.props["aria-describedby"] ?? describedBy,
              ...(required ? { "aria-required": true } : {}),
            })
          : children}
        {hint && (
          <p className="pm-field__hint" id={hintId}>
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** 켜기/끄기 스위치 */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cx("pm-switch", checked && "is-on")}
      onClick={() => onChange(!checked)}
    >
      <span className="pm-switch__knob" />
    </button>
  );
}
