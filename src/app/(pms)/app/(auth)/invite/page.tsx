import { Suspense } from "react";
import type { Metadata } from "next";
import { isLiveApi } from "@/infrastructure";
import { ErrorState, InvitePropertyList, InviteScreen, LoginScreen } from "@/ui/pms";
import {
  acceptInvitationAction,
  loginAction,
  resetPasswordAction,
  sendCodeAction,
  signupAction,
} from "../../_lib/actions";
import { readSession, serverApi } from "../../_lib/session";

export const metadata: Metadata = { title: "직원 초대" };

const authActions = isLiveApi
  ? { sendCode: sendCodeAction, signup: signupAction, login: loginAction, resetPassword: resetPasswordAction }
  : undefined;

/** 직원 초대 문자 링크 — /app/invite?token=… (로그인·가입 → 수락) */
export default function InvitePage({ searchParams }: PageProps<"/app/invite">) {
  return (
    <Suspense fallback={<div className="pm-loading" aria-busy="true" aria-label="불러오는 중" />}>
      <Invite searchParams={searchParams} />
    </Suspense>
  );
}

const ROLE = { OWNER: "공동 사장님", MANAGER: "매니저", STAFF: "직원" } as const;

async function Invite({ searchParams }: { searchParams: PageProps<"/app/invite">["searchParams"] }) {
  const { token } = await searchParams;
  if (typeof token !== "string" || token.length < 8) {
    return (
      <ErrorState
        full
        title="초대 링크가 올바르지 않아요"
        message="문자로 받은 링크를 다시 눌러 주세요. 7일이 지났다면 사장님께 다시 보내 달라고 해 주세요."
        homeHref="/app/login"
        homeLabel="로그인 화면으로"
      />
    );
  }
  const next = `/app/invite?token=${encodeURIComponent(token)}`;
  if (!isLiveApi) {
    return <InviteScreen token={token} me={{ name: "김민지", phone: "010-1111-2222" }} />;
  }
  // 로그인 전에도 어느 업장의 초대인지 보여 준다
  const preview = await (await serverApi()).invitationPreview(token).catch(() => null);
  if (!preview || preview.status !== "VALID") {
    return (
      <ErrorState
        full
        title={preview?.status === "USED" ? "이미 수락한 초대예요" : "초대 링크가 만료됐어요"}
        message={
          preview?.status === "USED"
            ? "로그인하면 바로 업장 화면으로 갈 수 있어요."
            : "초대는 7일 동안만 쓸 수 있어요. 사장님께 다시 보내 달라고 해 주세요."
        }
        homeHref="/app/login"
        homeLabel="로그인 화면으로"
      />
    );
  }
  const invite = {
    propertyName: preview.propertyName,
    role: ROLE[preview.role],
    phone: preview.phone,
    properties: preview.properties?.map((p) => ({ name: p.name, role: ROLE[p.role] })),
  };
  const many = (invite.properties?.length ?? 0) >= 2;
  const s = await readSession();
  const me = s.accessToken ? await (await serverApi(s.accessToken)).me().catch(() => null) : null;
  if (!me)
    return (
      <LoginScreen
        actions={authActions}
        next={next}
        notice={
          <>
            <strong>{invite.propertyName}에서 초대했어요</strong>
            초대 문자를 받은 번호({invite.phone})로 로그인하거나 가입하면 바로 수락할 수 있어요.
            {many && (
              <>
                {" "}
                수락하면 {invite.properties!.length}곳에 함께 참여해요.
                <InvitePropertyList properties={invite.properties!} />
              </>
            )}
          </>
        }
      />
    );
  return (
    <InviteScreen
      token={token}
      me={{ name: me.name, phone: me.phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3") }}
      accept={acceptInvitationAction}
      invite={invite}
      logoutPath="/app/session/logout"
    />
  );
}
