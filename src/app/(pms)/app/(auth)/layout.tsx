import { AstryxScope } from "@/ui/pms/components/Astryx";

/** 로그인 · 가입 · 온보딩 · 초대 · 근로계약 서명 — 버튼 · 입력창은 아스트릭스 (docs/PMS-DESIGN-V3.md) */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AstryxScope>{children}</AstryxScope>;
}
