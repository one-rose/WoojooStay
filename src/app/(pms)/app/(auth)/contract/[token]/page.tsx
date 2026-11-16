import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { demoDates, isLiveApi, pmsApi } from "@/infrastructure";
import { ContractScreen } from "@/ui/pms";
import { signContractAction } from "../../../_lib/actions";

export const metadata: Metadata = { title: "근로계약서" };

/** 직원이 문자로 받은 링크 — 로그인 없이 연다 (F5-06) */
export default function ContractPage({ params }: PageProps<"/app/contract/[token]">) {
  return (
    <Suspense>
      <Contract params={params} />
    </Suspense>
  );
}

async function Contract({ params }: { params: PageProps<"/app/contract/[token]">["params"] }) {
  const { token } = await params;
  if (!isLiveApi) {
    await connection();
    return (
      <ContractScreen
        contract={demoDates({
          status: "SENT",
          employer: {
            name: "스테이 오르빗 을지로",
            owner: "정현",
            address: "서울 중구 을지로 OO길 12",
            bizNo: "1234567891",
          },
          employee: { name: "김민지", jobRole: "FRONT" },
          startDate: "2026-11-01",
          payText: "시급 11,000원",
          signedAt: null,
        } as const)}
      />
    );
  }
  const contract = await pmsApi()
    .contract(token)
    .catch(() => null);
  return <ContractScreen contract={contract} sign={signContractAction.bind(null, token)} />;
}
