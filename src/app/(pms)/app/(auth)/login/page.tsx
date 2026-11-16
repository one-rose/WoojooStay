import type { Metadata } from "next";
import Link from "next/link";
import { isLiveApi } from "@/infrastructure";
import { LoginScreen } from "@/ui/pms";
import { loginAction, resetPasswordAction, sendCodeAction, signupAction } from "../../_lib/actions";

export const metadata: Metadata = { title: "로그인" };

/** ?next= (돌아갈 곳)은 화면이 제출할 때 주소에서 읽는다 — 페이지는 정적으로 둔다 */
/** 체험 모드 — 아무 번호로나 들어가지만, 누구 화면을 볼지 바로 고를 수 있게 */
const demoNotice = (
  <>
    <strong>체험 모드예요</strong>
    아무 번호나 넣고 로그인하면 사장님 화면으로 들어가요.
    <span className="au-demo-links">
      <Link href="/app">사장님 화면</Link>
      <Link href="/app/me">직원 화면</Link>
      <Link href="/admin">운영자 화면</Link>
    </span>
  </>
);

export default function LoginPage() {
  return (
    <LoginScreen
      notice={isLiveApi ? undefined : demoNotice}
      actions={
        isLiveApi
          ? { sendCode: sendCodeAction, signup: signupAction, login: loginAction, resetPassword: resetPasswordAction }
          : undefined
      }
    />
  );
}
