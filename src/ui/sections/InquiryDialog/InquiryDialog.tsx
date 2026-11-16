"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { InquiryContent } from "@/core";
import "./inquiry-dialog.css";

export interface InquiryInput {
  type: "INTRO" | "PARTNER";
  contactName: string;
  phone: string;
  email?: string;
  propertyName?: string;
  propertyType?: "HOTEL" | "MOTEL" | "PENSION" | "GUESTHOUSE" | "OTHER";
  rooms?: number;
  message: string;
}

export type SubmitInquiry = (input: InquiryInput) => Promise<{ ok: true } | { ok: false; message: string }>;

/** 문의 버튼(href="#partner")을 누르거나 주소가 #inquiry 로 열리면 뜨는 도입·파트너 문의 창 (F0-16) */
export function InquiryDialog({
  content,
  submit,
  serverMessages = false,
}: {
  content: InquiryContent;
  submit: SubmitInquiry;
  /** 서버 오류 문구(한국어)를 그대로 보여줄지 — 한국어 페이지만 */
  serverMessages?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<InquiryInput["type"]>("INTRO");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const open = () => {
      setDone(false);
      setError(null);
      ref.current?.showModal();
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href="#partner"]');
      if (!a) return;
      e.preventDefault();
      open();
    };
    document.addEventListener("click", onClick);
    if (location.hash === "#inquiry") open();
    return () => document.removeEventListener("click", onClick);
  }, []);

  const close = () => ref.current?.close();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    const rooms = Number(text("rooms"));
    start(async () => {
      setError(null);
      const r = await submit({
        type: kind,
        contactName: text("name"),
        phone: text("phone"),
        email: text("email") || undefined,
        propertyName: text("property") || undefined,
        propertyType:
          kind === "INTRO" ? (text("propertyType") as InquiryInput["propertyType"]) || undefined : undefined,
        rooms: kind === "INTRO" && rooms > 0 ? rooms : undefined,
        message: text("message"),
      });
      if (r.ok) setDone(true);
      else setError((serverMessages && r.message) || content.error);
    });
  };

  const c = content;
  return (
    <dialog ref={ref} className="inq" aria-labelledby="inq-title" onClick={(e) => e.target === ref.current && close()}>
      <div className="inq__box">
        <button type="button" className="inq__x" aria-label={c.close} onClick={close}>
          ×
        </button>
        {done ? (
          <div className="inq__done">
            <h2 id="inq-title">{c.done.title}</h2>
            <p>{c.done.message}</p>
            <button type="button" className="btn btn--grad" onClick={close}>
              {c.close}
            </button>
          </div>
        ) : (
          <form className="inq__form" onSubmit={onSubmit}>
            <h2 id="inq-title">{c.title}</h2>
            <p className="inq__desc">{c.description}</p>
            <div className="inq__kinds" role="radiogroup">
              {(["INTRO", "PARTNER"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  className={kind === k ? "is-on" : undefined}
                  onClick={() => setKind(k)}
                >
                  {k === "INTRO" ? c.kinds.intro : c.kinds.partner}
                </button>
              ))}
            </div>
            <div className="inq__row">
              <label>
                <span>{c.fields.name}</span>
                <input name="name" required maxLength={30} autoComplete="name" />
              </label>
              <label>
                <span>{c.fields.phone}</span>
                <input
                  name="phone"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={c.fields.phonePlaceholder}
                  pattern="[+0-9\s\-]{9,20}"
                />
              </label>
            </div>
            <label>
              <span>
                {c.fields.email} <em>{c.optional}</em>
              </span>
              <input name="email" type="email" autoComplete="email" />
            </label>
            <label>
              <span>
                {c.fields.property}
                {kind === "PARTNER" && <em>{c.optional}</em>}
              </span>
              <input name="property" maxLength={60} required={kind === "INTRO"} />
            </label>
            {kind === "INTRO" && (
              <div className="inq__row">
                <label>
                  <span>{c.fields.propertyType}</span>
                  <select name="propertyType" defaultValue="HOTEL">
                    {(Object.keys(c.propertyTypes) as (keyof InquiryContent["propertyTypes"])[]).map((t) => (
                      <option key={t} value={t.toUpperCase()}>
                        {c.propertyTypes[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>
                    {c.fields.rooms} <em>{c.optional}</em>
                  </span>
                  <input name="rooms" type="number" min={1} max={2000} inputMode="numeric" />
                </label>
              </div>
            )}
            <label>
              <span>{c.fields.message}</span>
              <textarea name="message" required rows={4} maxLength={2000} placeholder={c.fields.messagePlaceholder} />
            </label>
            <label className="inq__consent">
              <input type="checkbox" required />
              <span>{c.consent}</span>
            </label>
            {error && <p className="inq__error">{error}</p>}
            <button type="submit" className="btn btn--grad inq__submit" disabled={pending}>
              {pending ? c.sending : c.submit}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
