"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AcceptInvitationAction } from "@/core";
import { josa } from "@/shared";
import { PmButton } from "../../components";
import { AuthBrand } from "./AuthBrand";
import "./auth.css";

interface InviteScreenProps {
  token: string;
  /** 로그인한 사람 */
  me: { name: string; phone: string };
  accept?: AcceptInvitationAction;
  /** 다른 번호로 로그인할 때 (POST) */
  logoutPath?: string;
  /** 초대 미리보기 — 어느 업장의 어떤 역할인지 */
  invite?: InvitePreview;
}

export interface InvitePreview {
  propertyName: string;
  role: string;
  phone: string;
}

/** 직원 초대 수락 — 문자 링크 /app/invite?token=… 로 들어와 로그인한 뒤 */
export function InviteScreen({ token, me, accept, logoutPath, invite }: InviteScreenProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ message: string; mismatch: boolean } | null>(null);
  const [joined, setJoined] = useState<string | null>(null);

  const onAccept = () =>
    start(async () => {
      setError(null);
      if (!accept) {
        setJoined("스테이 오르빗 을지로");
        return router.push("/app/me");
      }
      const r = await accept(token);
      if (!r.ok) {
        setError({ message: r.message, mismatch: r.errorCode === "INVITATION_PHONE_MISMATCH" });
        return;
      }
      setJoined(r.data.propertyName ?? "업장");
      router.push(r.data.next);
      router.refresh();
    });

  return (
    <div className="au">
      <AuthBrand />
      <main className="au-main">
        <div className="au-card">
          <header className="au-reset-head">
            <h2>{invite ? `${invite.propertyName}에서 초대했어요` : "직원 초대를 받으셨어요"}</h2>
            <p>
              {invite
                ? `${josa(invite.role, "으로/로")} 참여하게 돼요. 초대받은 번호(${invite.phone})로 로그인한 상태여야 수락할 수 있어요.`
                : "문자로 받은 초대를 수락하면 그 업장의 구성원으로 참여해요."}
            </p>
          </header>

          <div className="au-notice">
            <strong>{me.name}님으로 로그인되어 있어요</strong>
            휴대폰 번호 <span className="num">{me.phone}</span> — 초대받은 번호와 같아야 수락할 수 있어요.
          </div>

          {joined && (
            <p className="au-done" role="status">
              {joined}에 참여했어요. 화면으로 이동하고 있어요…
            </p>
          )}
          {error && (
            <p className="pm-error" role="alert">
              {error.message}
            </p>
          )}

          <PmButton variant="primary" className="au-submit" onClick={onAccept} disabled={pending || Boolean(joined)}>
            {pending ? "수락하는 중…" : "초대 수락하기"}
          </PmButton>

          {logoutPath && (
            <form
              action={`${logoutPath}?next=${encodeURIComponent(`/app/invite?token=${token}`)}`}
              method="post"
              className="au-links"
            >
              <button type="submit">
                {error?.mismatch ? "초대받은 번호로 다시 로그인하기" : "다른 번호로 로그인하기"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
