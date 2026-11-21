"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminAuthActions } from "@/core";
import { Logo } from "@/ui/brand";
import { Icon } from "../../components";
import { AxButton, AxTextField } from "../../components/Astryx";
import "../Auth/auth.css";
import "../Auth/login.css";
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
    <div className="lg4">
      <header className="lg4-top">
        <Logo className="lg4-logo" />
      </header>
      <main className="lg4-main">
        <div>
          <form className="lg4-form" onSubmit={submit}>
            <header className="lg4-head">
              <h1 className="lg4-title">운영자 로그인</h1>
              <p className="lg4-desc">
                <Icon name="lock" size={15} /> 운영팀에서 발급한 계정만 들어올 수 있어요. 8시간이 지나면 자동으로
                로그아웃돼요.
              </p>
            </header>
            <AxTextField
              label="이메일"
              type="email"
              placeholder="name@woojoo.kr"
              autoComplete="username"
              value={email}
              onChange={setEmail}
            />
            <AxTextField
              label="비밀번호"
              type="password"
              placeholder="비밀번호"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
            />
            {error && <p className="pm-error">{error}</p>}
            <div className="lg4-cta">
              <AxButton variant="navy" type="submit" className="lg4-submit" loading={pending}>
                로그인하기
              </AxButton>
            </div>
            <p className="lg4-desc lg4-center">계정이 필요하면 최고 관리자에게 요청해 주세요.</p>
          </form>
        </div>
      </main>
    </div>
  );
}
