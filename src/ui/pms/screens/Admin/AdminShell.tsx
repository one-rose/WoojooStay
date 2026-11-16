import Link from "next/link";
import type { AdminData } from "@/core";
import { Logo } from "@/ui/brand";
import { DemoBar, Icon } from "../../components";
import "./admin.css";

/** 운영자 화면 틀 — 사장님 앱 사이드바와 분리된 상단바만 */
export function AdminShell({
  me,
  logoutPath,
  children,
}: {
  me?: AdminData["me"];
  logoutPath?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ad-shell">
      {!logoutPath && !me && <DemoBar current="/admin" />}
      <header className="ad-top">
        <Link href="/admin" className="ad-top__brand">
          <Logo tone="footer" className="ad-top__logo" />
          <span className="ad-top__tag">BACK OFFICE</span>
        </Link>
        <div className="ad-top__right">
          {me && (
            <span className="ad-top__me">
              {me.name}
              <small>{me.role === "SUPER" ? "최고 관리자" : "운영자"}</small>
            </span>
          )}
          {logoutPath ? (
            <form action={logoutPath} method="post">
              <button type="submit" className="ad-top__out">
                <Icon name="logout" size={14} /> 로그아웃
              </button>
            </form>
          ) : (
            <span className="ad-top__demo">예시 데이터</span>
          )}
        </div>
      </header>
      <main className="ad-main">{children}</main>
    </div>
  );
}
