import type { Metadata } from "next";
import { isLiveApi } from "@/infrastructure";
import { AdminLoginScreen } from "@/ui/pms";
import { adminLoginAction } from "../_lib/actions";

export const metadata: Metadata = { title: "운영자 로그인" };

export default function AdminLoginPage() {
  return <AdminLoginScreen actions={isLiveApi ? { login: adminLoginAction } : undefined} />;
}
