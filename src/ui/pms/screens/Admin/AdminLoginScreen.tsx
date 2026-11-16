"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminAuthActions } from "@/core";
import { Logo } from "@/ui/brand";
import { Field, Icon, PmButton } from "../../components";
import "../Auth/auth.css";
import "./admin.css";

/** 운영자 로그인 (F0-14) — 사장님 앱과 다른 계정·다른 주소. actions 가 없으면 시안 */
export function AdminLoginScreen({ actions }: { actions?: AdminAuthActions }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actions) return router.push("/admin");
    start(async () => {
      setError(null);
      const r = await actions.login(email, password);
      if (r.ok) router.push(r.data.next);
      else setError(r.message);
    });
  };

  return (
    <div className="au ad-login">
      <aside className="au-brand">
        <Logo tone="footer" className="au-brand__logo" />
        <div>
          <h1 className="au-brand__title">
            우주스테이
            <br />
            운영팀 백오피스
          </h1>
        </div>
        <ul className="au-brand__list">
          <li>
            <Icon name="lock" size={16} /> 운영팀에서 발급한 계정만 들어올 수 있어요
          </li>
          <li>
            <Icon name="lock" size={16} /> 8시간이 지나면 자동으로 로그아웃돼요
          </li>
        </ul>
      </aside>
      <main className="au-main">
        <div className="au-card">
          <h2 className="ad-login__title">운영자 로그인</h2>
          <form className="au-form" onSubmit={submit}>
            <Field label="이메일">
              <input
                className="pm-input"
                type="email"
                placeholder="name@woojoo.kr"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="비밀번호">
              <input
                className="pm-input"
                type="password"
                placeholder="비밀번호"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            {error && <p className="pm-error">{error}</p>}
            <PmButton variant="navy" type="submit" className="au-submit" disabled={pending}>
              {pending ? "확인 중…" : "로그인"}
            </PmButton>
            <p className="au-links">계정이 필요하면 최고 관리자에게 요청해 주세요.</p>
          </form>
        </div>
      </main>
    </div>
  );
}
