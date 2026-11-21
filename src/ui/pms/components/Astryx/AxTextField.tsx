"use client";

import { TextInput } from "@astryxdesign/core/TextInput";
import type { ReactNode } from "react";

type InputMode = "text" | "tel" | "numeric" | "email" | "search" | "url" | "decimal" | "none";

interface AxTextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password" | "email" | "search" | "tel" | "url";
  placeholder?: string;
  /** 이름표를 화면에서 숨김 (읽기 프로그램에는 들린다) — 검색칸처럼 자리가 이름을 말해 줄 때 */
  labelHidden?: boolean;
  /** 최대 글자 수 — 넘치면 잘라 넣는다 */
  maxLength?: number;
  /** 입력칸 아래 도움말 (입력칸 오른쪽 끝 [end] 위치가 흔들리지 않게 상자 밖에 그린다) */
  hint?: string;
  /** 오류 문장 — 있으면 빨간 테두리 + 문장 */
  error?: string;
  disabled?: boolean;
  inputMode?: InputMode;
  autoComplete?: React.InputHTMLAttributes<HTMLInputElement>["autoComplete"];
  name?: string;
  id?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
  /** 입력칸 오른쪽 끝에 붙는 것 (비밀번호 보기 버튼 등) */
  end?: ReactNode;
  className?: string;
}

/**
 * 입력창 — 로그인 · 관리자 화면용 아스트릭스 TextInput. 이름표 · 도움말 · 오류를 한 번에 그린다 (Field 대신).
 * onChange 는 값만 넘긴다.
 */
export function AxTextField({
  label,
  labelHidden,
  maxLength,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  error,
  disabled,
  inputMode,
  autoComplete,
  name,
  id,
  autoFocus,
  onEnter,
  end,
  className,
}: AxTextFieldProps) {
  return (
    <div className={className ? `ax-field ${className}` : "ax-field"}>
      <div className={end ? "ax-field__box ax-field__box--end" : "ax-field__box"}>
        <TextInput
          label={label}
          isLabelHidden={labelHidden}
          value={value}
          onChange={(v) => onChange(maxLength ? v.slice(0, maxLength) : v)}
          type={type}
          placeholder={placeholder}
          isDisabled={disabled}
          inputMode={inputMode}
          autoComplete={autoComplete}
          htmlName={name}
          id={id}
          hasAutoFocus={autoFocus}
          onEnter={onEnter}
          status={error ? { type: "error", message: error } : undefined}
          statusVariant="detached"
          width="100%"
        />
        {end && <div className="ax-field__end">{end}</div>}
      </div>
      {hint && <p className="ax-field__hint">{hint}</p>}
    </div>
  );
}
