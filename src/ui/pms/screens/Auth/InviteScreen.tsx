"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AcceptInvitationAction } from "@/core";
import { josa } from "@/shared";
import { AxButton } from "../../components/Astryx";
import Link from "next/link";
import { Logo } from "@/ui/brand";
import "./login.css";
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
  /** 수락하면 함께 합류할 업장과 업장별 권한 (첫 줄이 이 링크 업장) — 2곳 이상일 때 목록으로 */
  properties?: readonly { name: string; role: string }[];
}

/** 직원 초대 수락 — 문자 링크 /app/invite?token=… 로 들어와 로그인한 뒤 */
export function InviteScreen({ token, me, accept, logoutPath, invite }: InviteScreenProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ message: string; mismatch: boolean } | null>(null);
  const [joined, setJoined] = useState<string | null>(null);
  const many = (invite?.properties?.length ?? 0) >= 2;

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
    <div className="lg4">
      <header className="lg4-top">
        <Link href="/" aria-label="우주스테이 소개로">
          <Logo className="lg4-logo" />
        </Link>
      </header>
      <main className="lg4-main">
        <div className="lg4-form">
          <header className="lg4-head">
            <h1 className="lg4-title">{invite ? `${invite.propertyName}에서 초대했어요` : "직원 초대를 받으셨어요"}</h1>
            <p className="lg4-desc">
              {invite
                ? many
                  ? `수락하면 아래 ${invite.properties!.length}곳에 함께 참여해요. 초대받은 번호(${invite.phone})로 로그인한 상태여야 수락할 수 있어요.`
                  : `${josa(invite.role, "으로/로")} 참여하게 돼요. 초대받은 번호(${invite.phone})로 로그인한 상태여야 수락할 수 있어요.`
                : "문자로 받은 초대를 수락하면 그 업장의 구성원으로 참여해요."}
            </p>
          </header>

          {many && <InvitePropertyList properties={invite!.properties!} />}

          <div className="lg4-notice">
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

          <div className="lg4-cta">
            <AxButton
              variant="brand"
              className="lg4-submit"
              onClick={onAccept}
              disabled={Boolean(joined)}
              loading={pending}
            >
              초대 수락하기
            </AxButton>
          </div>

          {logoutPath && (
            <form
              action={`${logoutPath}?next=${encodeURIComponent(`/app/invite?token=${token}`)}`}
              method="post"
              className="lg4-links"
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

/** 함께 받은 초대 — 업장마다 권한 */
export function InvitePropertyList({ properties }: { properties: readonly { name: string; role: string }[] }) {
  return (
    <ul className="au-invites" aria-label="참여할 업장">
      {properties.map((p, i) => (
        <li key={`${p.name}${i}`}>
          <span>{p.name}</span>
          <span className="au-invites__role">{p.role}</span>
        </li>
      ))}
    </ul>
  );
}
