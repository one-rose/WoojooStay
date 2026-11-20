"use client";

import type { AdminAttention, AdminAttentionKind } from "@/core";
import { Badge, Card, TableWrap, type BadgeTone } from "../../components";

const KIND: Record<AdminAttentionKind, { tone: BadgeTone; label: string }> = {
  NO_CHANNEL: { tone: "warn", label: "채널 미연결" },
  UNANSWERED: { tone: "bad", label: "미답변 쌓임" },
  NO_LOGIN: { tone: "neutral", label: "미접속" },
};

const phone = (p: string) => p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");

/**
 * 운영팀이 오늘 전화할 곳 — 채널을 아직 안 붙였거나, 답글이 밀렸거나, 며칠째 안 들어온 업장.
 * 실증 업장이 먼저, 사유가 많은 순. 업장 이름을 누르면 상세(지원 메모 남기기)가 열린다.
 */
export function AdminAttentionTab({ data, onOpen }: { data: AdminAttention; onOpen: (propertyId: string) => void }) {
  const r = data.rules;
  return (
    <Card flush>
      <p className="ad-attn__rule">
        가입 {r.noChannelHours}시간이 지나도 채널이 없거나, {r.unansweredHours}시간 넘은 미답변 리뷰가 있거나,{" "}
        {r.noLoginDays}일 넘게 접속하지 않은 업장이에요.
      </p>
      <TableWrap>
        <table className="pm-table">
          <thead>
            <tr>
              <th>업장</th>
              <th>사장님</th>
              <th>사유</th>
              <th>최근 접속</th>
              <th>담당</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="is-muted">
                  지금 연락할 업장이 없어요.
                </td>
              </tr>
            )}
            {data.items.map((x) => (
              <tr key={x.property.id}>
                <td>
                  <button type="button" className="ad-row__open" onClick={() => onOpen(x.property.id)}>
                    <strong>{x.property.name}</strong>
                  </button>
                  {x.property.pilotGroup && <small className="ad-sub">실증 {x.property.pilotGroup}</small>}
                </td>
                <td>
                  {x.owner ? (
                    <>
                      {x.owner.name}
                      <a className="ad-sub num ad-tel" href={`tel:${x.owner.phone}`}>
                        {phone(x.owner.phone)}
                      </a>
                    </>
                  ) : (
                    <span className="is-muted">-</span>
                  )}
                </td>
                <td className="is-wrap">
                  <ul className="ad-attn__reasons">
                    {x.reasons.map((m) => (
                      <li key={m.kind}>
                        <Badge tone={KIND[m.kind].tone}>{KIND[m.kind].label}</Badge>
                        <span>{m.text}</span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="num is-muted">{x.lastLoginAt?.replaceAll("-", ".") ?? "기록 없음"}</td>
                <td>{x.manager?.name ?? <span className="is-muted">미지정</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Card>
  );
}
