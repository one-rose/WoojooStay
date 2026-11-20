"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/core";
import { formatNumber } from "@/shared";
import { Logo } from "@/ui/brand";
import { Badge, ErrorState, Field, PmButton } from "../../components";
import "./contract.css";

export interface ContractView {
  status: "SENT" | "SIGNED";
  employer: { name: string; owner: string; address: string; bizNo: string };
  employee: { name: string; jobRole: string };
  startDate: string;
  payText: string;
  signedAt: string | null;
}

const JOB: Record<string, string> = { MANAGER: "매니저", FRONT: "프런트", NIGHT: "야간", HOUSEKEEPING: "하우스키핑" };

/** 직원이 문자 링크로 여는 근로계약서 전자서명 (F5-06) */
export function ContractScreen({
  contract,
  sign,
}: {
  contract: ContractView | null;
  sign?: (name: string) => Promise<ActionResult<{ status: string }>>;
}) {
  const [signed, setSigned] = useState(contract?.status === "SIGNED");
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!contract)
    return (
      <main className="ct">
        <Logo className="ct-logo" />
        <ErrorState
          title="계약서를 열 수 없어요"
          message="링크가 만료됐거나 잘못됐어요. 사장님께 계약서를 다시 보내 달라고 요청해 주세요."
        />
      </main>
    );

  const c = contract;
  return (
    <main className="ct">
      <Logo className="ct-logo" />
      <h1 className="ct-title">표준 근로계약서</h1>
      <p className="ct-sub">
        <span>{c.employer.name}</span>
        {signed ? <Badge tone="ok">서명 완료</Badge> : <Badge tone="info">서명 대기</Badge>}
      </p>
      <dl className="ct-terms">
        <dt>사업주</dt>
        <dd>
          {c.employer.name} (대표 {c.employer.owner})
          <small>
            {c.employer.address}, 사업자 {c.employer.bizNo.replace(/^(\d{3})(\d{2})(\d{5})$/, "$1-$2-$3")}
          </small>
        </dd>
        <dt>근로자</dt>
        <dd>
          {c.employee.name} ({JOB[c.employee.jobRole] ?? c.employee.jobRole})
        </dd>
        <dt>근로 시작일</dt>
        <dd className="num">{c.startDate.replaceAll("-", ".")}</dd>
        <dt>임금</dt>
        <dd>{c.payText}</dd>
        <dt>수당</dt>
        <dd>야간근로(22~06시) 50% 가산, 주 15시간 이상 근무 시 주휴수당</dd>
        <dt>지급</dt>
        <dd>매월 10일, 본인 명의 계좌로 지급</dd>
      </dl>
      <p className="ct-note">
        이 계약서는 고용노동부 표준 근로계약서 항목을 바탕으로 한 예시입니다. 최종 문구는 노무 검토 후 확정돼요.
        (최저시급 {formatNumber(10_320)}원 기준)
      </p>

      {signed ? (
        <p className="ct-done">서명을 마쳤어요. 사장님께도 알려 드렸어요.</p>
      ) : (
        <form
          className="ct-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!sign) return setSigned(true);
            start(async () => {
              setError(null);
              const r = await sign(name.trim());
              if (r.ok) setSigned(true);
              else setError(r.message);
            });
          }}
        >
          <label className="ct-agree">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />위 내용을 읽고
            동의합니다
          </label>
          <Field label="서명 (이름을 입력해 주세요)">
            <input
              className="pm-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={c.employee.name}
            />
          </Field>
          {error && <p className="pm-error">{error}</p>}
          <PmButton variant="primary" type="submit" disabled={pending || !agree || !name.trim()}>
            {pending ? "서명 중…" : "전자서명하기"}
          </PmButton>
        </form>
      )}
    </main>
  );
}
