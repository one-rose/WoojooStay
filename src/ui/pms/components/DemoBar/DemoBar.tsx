import Link from "next/link";
import "./demo-bar.css";

const VIEWS = [
  { href: "/app", label: "사장님" },
  { href: "/app/me", label: "직원" },
  { href: "/admin", label: "운영자" },
] as const;

/**
 * 체험 모드 안내 — 서버 없이 배포했을 때만 보인다.
 * 예시 데이터라는 것과, 다른 사람 입장의 화면으로 바로 가는 길을 함께 준다.
 */
export function DemoBar({ current }: { current?: "/app" | "/app/me" | "/admin" }) {
  return (
    <div className="pm-demo" role="note">
      <p>
        <strong>체험 모드</strong>
        <span>예시 데이터로 보여드려요. 바꾼 내용은 저장되지 않아요.</span>
      </p>
      <nav aria-label="다른 화면 보기">
        {VIEWS.map((v) => (
          <Link key={v.href} href={v.href} aria-current={current === v.href ? "page" : undefined}>
            {v.label} 화면
          </Link>
        ))}
      </nav>
    </div>
  );
}
