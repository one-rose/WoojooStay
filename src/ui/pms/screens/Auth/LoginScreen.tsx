"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthActions } from "@/core";
import { cx } from "@/shared";
import { Field, Modal, PmButton, Tabs } from "../../components";
import { AuthBrand } from "./AuthBrand";
import "./auth.css";

type Mode = "login" | "signup" | "reset";
const MODES = [
  { id: "login", label: "로그인" },
  { id: "signup", label: "회원가입" },
] as const;

type TermId = "service" | "privacy" | "marketing";
const TERMS: readonly { id: TermId; label: string; required: boolean }[] = [
  { id: "service", label: "서비스 이용약관", required: true },
  { id: "privacy", label: "개인정보 수집·이용", required: true },
  { id: "marketing", label: "혜택·이벤트 알림 받기", required: false },
];

/** 약관 요약 — 법무 검토 전 초안 (정식 약관 확정 시 교체) */
const TERM_DOCS: Record<TermId, { title: string; body: readonly string[] }> = {
  service: {
    title: "서비스 이용약관 (요약, 초안)",
    body: [
      "우주스테이는 숙박업 사장님이 예약 채널의 리뷰·매출·정산 정보를 한곳에서 관리하도록 돕는 서비스예요.",
      "채널 계정 정보는 사장님이 동의한 범위에서 수집·연동에만 쓰고, 언제든 연결을 끊을 수 있어요.",
      "유료 서비스는 첫 달 무료 체험 뒤 사장님이 켜 둔 서비스만 매월 결제돼요. 해지하면 다음 결제일부터 청구되지 않아요.",
      "AI 답글 초안은 사장님이 확인하고 게시하는 것을 원칙으로 하며, 게시한 답글의 책임은 게시한 계정에 있어요.",
    ],
  },
  privacy: {
    title: "개인정보 수집·이용 (요약, 초안)",
    body: [
      "수집 항목: 휴대폰 번호, 이름, 이메일(선택), 업장 정보, 연동한 채널의 예약·리뷰 정보",
      "이용 목적: 회원 식별·로그인, 서비스 제공, 결제, 고객 상담",
      "보관 기간: 탈퇴할 때까지. 단, 관련 법령에 따라 결제 기록 등은 정해진 기간 동안 보관해요.",
      "동의하지 않을 수 있지만, 필수 항목에 동의하지 않으면 가입할 수 없어요.",
    ],
  },
  marketing: {
    title: "혜택·이벤트 알림 (선택, 초안)",
    body: [
      "새 기능, 할인, 이벤트 소식을 문자·알림톡·이메일로 보내 드려요.",
      "동의하지 않아도 서비스는 그대로 쓸 수 있고, 설정에서 언제든 끌 수 있어요.",
    ],
  },
};

interface LoginScreenProps {
  actions?: AuthActions;
  /** 로그인·가입 뒤 돌아갈 곳 (초대 수락 등) */
  next?: string;
  /** 카드 위에 보일 안내 (초대 받은 경우 등) */
  notice?: ReactNode;
  /** 처음 보여줄 탭 */
  initialMode?: "login" | "signup";
}

/** 가입·로그인 (F0-01) + 약관 동의 (F0-17) + 비밀번호 재설정. actions 가 없으면 화면만 동작하는 시안 */
/** 주소의 ?next= — 앱 안 경로만 */
const nextFromUrl = () => {
  const v = new URLSearchParams(window.location.search).get("next");
  return v && v.startsWith("/app") && !v.startsWith("//") ? v : undefined;
};

export function LoginScreen({ actions, next: nextProp, notice, initialMode = "login" }: LoginScreenProps) {
  const router = useRouter();
  const target = () => nextProp ?? nextFromUrl();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [codeSent, setCodeSent] = useState(false);
  const [left, setLeft] = useState(180);
  const [agreed, setAgreed] = useState<TermId[]>([]);
  const [viewTerm, setViewTerm] = useState<TermId | null>(null);
  const [form, setForm] = useState({ phone: "", password: "", code: "", name: "", email: "", newPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const run = (fn: () => Promise<{ ok: true; data: { next: string } } | { ok: false; message: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) router.push(r.data.next);
      else setError(r.message);
    });

  useEffect(() => {
    if (!codeSent) return;
    const t = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [codeSent]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setCodeSent(false);
    setDevCode(null);
    setForm((f) => ({ ...f, code: "", newPassword: "" }));
  };

  const requiredOk = TERMS.filter((t) => t.required).every((t) => agreed.includes(t.id));
  const allOn = agreed.length === TERMS.length;
  const toggle = (id: TermId) => setAgreed((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const sendCode = () =>
    start(async () => {
      setError(null);
      if (!form.phone.trim()) return setError("휴대폰 번호를 입력해 주세요.");
      if (actions) {
        const r = await actions.sendCode(form.phone, mode === "reset" ? "reset" : "signup");
        if (!r.ok) return setError(r.message);
        setDevCode(r.data.devCode ?? null);
      }
      setCodeSent(true);
      setLeft(180);
    });

  const phoneWithCode = (
    <>
      <Field
        label="휴대폰 번호"
        required
        hint={mode === "signup" ? "휴대폰 번호가 아이디가 돼요. 한 번호로 한 계정만 만들 수 있어요." : undefined}
      >
        <div className="au-inline">
          <input
            className="pm-input"
            inputMode="tel"
            placeholder="010-0000-0000"
            autoComplete="tel"
            value={form.phone}
            onChange={set("phone")}
          />
          <PmButton variant={codeSent ? "ghost" : "navy"} onClick={sendCode} disabled={pending}>
            {codeSent ? "다시 받기" : "인증번호 받기"}
          </PmButton>
        </div>
      </Field>
      {codeSent && (
        <Field
          label="인증번호"
          required
          hint={left > 0 ? "문자로 받은 6자리 숫자를 입력해 주세요." : "시간이 지났어요. 다시 받아 주세요."}
        >
          <div className="au-code">
            <input
              className="pm-input num"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={form.code}
              onChange={set("code")}
            />
            <span className={cx("au-code__timer num", left === 0 && "is-over")} aria-label={`남은 시간 ${left}초`}>
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
            </span>
          </div>
          {devCode && <p className="pm-devhint">개발 서버 인증번호: {devCode}</p>}
        </Field>
      )}
    </>
  );

  return (
    <div className="au">
      <AuthBrand />

      <main className="au-main">
        <div className="au-card">
          {notice && <div className="au-notice">{notice}</div>}

          {mode === "reset" ? (
            <form
              className="au-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!codeSent) return setError("인증번호를 먼저 받아 주세요.");
                if (form.newPassword.length < 8) return setError("새 비밀번호를 8자 이상으로 입력해 주세요.");
                start(async () => {
                  setError(null);
                  if (actions) {
                    const r = await actions.resetPassword(form.phone, form.code, form.newPassword);
                    if (!r.ok) return setError(r.message);
                  }
                  switchMode("login");
                  setDone("비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.");
                });
              }}
            >
              <header className="au-reset-head">
                <h2>비밀번호 재설정</h2>
                <p>가입한 휴대폰 번호로 인증하면 새 비밀번호를 정할 수 있어요.</p>
              </header>
              {phoneWithCode}
              <Field label="새 비밀번호" required hint="영문·숫자 포함 8자 이상">
                <input
                  className="pm-input"
                  type="password"
                  autoComplete="new-password"
                  value={form.newPassword}
                  onChange={set("newPassword")}
                />
              </Field>
              {error && (
                <p className="pm-error" role="alert">
                  {error}
                </p>
              )}
              <PmButton variant="primary" type="submit" className="au-submit" disabled={pending || !codeSent}>
                {pending ? "바꾸는 중…" : "비밀번호 바꾸기"}
              </PmButton>
              <p className="au-links">
                <button type="button" onClick={() => switchMode("login")}>
                  로그인으로 돌아가기
                </button>
              </p>
            </form>
          ) : (
            <>
              <Tabs items={MODES} value={mode} onChange={(m) => switchMode(m)} label="로그인 또는 가입" />

              {mode === "login" ? (
                <form
                  className="au-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setDone(null);
                    if (actions) run(() => actions.login(form.phone, form.password, target()));
                    else router.push(target() ?? "/app");
                  }}
                >
                  {done && (
                    <p className="au-done" role="status">
                      {done}
                    </p>
                  )}
                  <Field label="휴대폰 번호">
                    <input
                      className="pm-input"
                      inputMode="tel"
                      placeholder="010-0000-0000"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={set("phone")}
                    />
                  </Field>
                  <Field label="비밀번호">
                    <input
                      className="pm-input"
                      type="password"
                      placeholder="비밀번호"
                      autoComplete="current-password"
                      value={form.password}
                      onChange={set("password")}
                    />
                  </Field>
                  {error && (
                    <p className="pm-error" role="alert">
                      {error}
                    </p>
                  )}
                  <PmButton variant="primary" type="submit" className="au-submit" disabled={pending}>
                    {pending ? "확인 중…" : "로그인"}
                  </PmButton>
                  <p className="au-links">
                    <button type="button" onClick={() => switchMode("reset")}>
                      비밀번호를 잊으셨나요?
                    </button>
                  </p>
                </form>
              ) : (
                <form
                  className="au-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!actions) return router.push(target() ?? "/app/onboarding");
                    run(() =>
                      actions.signup(
                        {
                          phone: form.phone,
                          code: form.code,
                          name: form.name,
                          email: form.email,
                          password: form.newPassword,
                          marketing: agreed.includes("marketing"),
                        },
                        target(),
                      ),
                    );
                  }}
                >
                  {phoneWithCode}
                  <Field label="이름" required>
                    <input
                      className="pm-input"
                      placeholder="이름"
                      autoComplete="name"
                      value={form.name}
                      onChange={set("name")}
                    />
                  </Field>
                  <Field label="이메일 (선택)">
                    <input
                      className="pm-input"
                      type="email"
                      placeholder="영수증·세금계산서 받을 주소"
                      autoComplete="email"
                      value={form.email}
                      onChange={set("email")}
                    />
                  </Field>
                  <Field label="비밀번호" required hint="영문·숫자 포함 8자 이상">
                    <input
                      className="pm-input"
                      type="password"
                      autoComplete="new-password"
                      value={form.newPassword}
                      onChange={set("newPassword")}
                    />
                  </Field>

                  <div className="au-terms" role="group" aria-label="약관 동의">
                    <div className="au-terms__row">
                      <label className="au-terms__all">
                        <input
                          type="checkbox"
                          checked={allOn}
                          onChange={() => setAgreed(allOn ? [] : TERMS.map((t) => t.id))}
                        />
                        전체 동의
                      </label>
                    </div>
                    {TERMS.map((t) => (
                      <div key={t.id} className="au-terms__row">
                        <label>
                          <input type="checkbox" checked={agreed.includes(t.id)} onChange={() => toggle(t.id)} />
                          <span>
                            <em className={t.required ? "is-req" : undefined}>{t.required ? "(필수)" : "(선택)"}</em>{" "}
                            {t.label}
                          </span>
                        </label>
                        <button
                          type="button"
                          className="au-terms__view"
                          onClick={() => setViewTerm(t.id)}
                          aria-label={`${t.label} 보기`}
                        >
                          보기
                        </button>
                      </div>
                    ))}
                  </div>

                  {error && (
                    <p className="pm-error" role="alert">
                      {error}
                    </p>
                  )}
                  <PmButton variant="primary" type="submit" disabled={!requiredOk || pending} className="au-submit">
                    {pending ? "가입 중…" : nextProp ? "가입하고 계속하기" : "가입하고 업장 등록하기"}
                  </PmButton>
                </form>
              )}
            </>
          )}
        </div>
        <p className="au-legal">
          <Link href="/">우주스테이 소개</Link>
          <button type="button" onClick={() => setViewTerm("service")}>
            이용약관
          </button>
          <button type="button" onClick={() => setViewTerm("privacy")}>
            개인정보 처리방침
          </button>
        </p>
      </main>

      {viewTerm && (
        <Modal
          title={TERM_DOCS[viewTerm].title}
          desc="정식 약관을 다듬는 중이라 요약본을 먼저 보여드려요."
          onClose={() => setViewTerm(null)}
          footer={
            <PmButton variant="navy" onClick={() => setViewTerm(null)}>
              확인
            </PmButton>
          }
        >
          <div className="au-terms-doc">
            <ol>
              {TERM_DOCS[viewTerm].body.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </div>
        </Modal>
      )}
    </div>
  );
}
