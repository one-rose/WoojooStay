"use client";

import { useState, useTransition } from "react";
import type { AdminActions, AdminData, ChannelConnection, ChannelId, Inquiry, PropertyType } from "@/core";
import {
  Badge,
  Card,
  ChannelChip,
  PageHead,
  PmButton,
  Stat,
  StatRow,
  TableWrap,
  Tabs,
  Tag,
  type BadgeTone,
} from "../../components";
import "./admin.css";

type Tab = "properties" | "sync" | "inquiries";
const TYPE: Record<PropertyType, string> = {
  hotel: "호텔",
  motel: "모텔",
  pension: "펜션",
  guesthouse: "게스트하우스",
};
const PLAN: Record<string, string> = { review: "리뷰", ledger: "매출장부", staff: "알바", expense: "지출" };
const STATUS: Record<Inquiry["status"], { tone: BadgeTone; label: string }> = {
  new: { tone: "warn", label: "접수" },
  contacted: { tone: "info", label: "연락함" },
  done: { tone: "ok", label: "완료" },
};
const NEXT: Record<Inquiry["status"], Inquiry["status"]> = { new: "contacted", contacted: "done", done: "done" };

const won = (n: number) => n.toLocaleString("ko-KR");

/**
 * 우주스테이 운영팀 백오피스 (F0-14) · 도입·파트너 문의 (F0-16)
 * actions 가 없으면 예시 데이터로 화면만 동작
 */
export function AdminScreen({
  data,
  channels,
  actions,
}: {
  data: AdminData;
  channels: readonly ChannelConnection[];
  actions?: AdminActions;
}) {
  const [tab, setTab] = useState<Tab>("properties");
  const [inq, setInq] = useState(data.inquiries);
  const [issues, setIssues] = useState(data.syncIssues);
  const [note, setNote] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const names = Object.fromEntries(channels.map((c) => [c.channel, c.name])) as Record<ChannelId, string>;
  const fresh = inq.filter((q) => q.status === "new").length;
  const ov = data.overview;
  const subscribed = data.properties.filter((p) => p.plans.length > 0).length;

  const moveInquiry = (q: Inquiry) =>
    start(async () => {
      const next = NEXT[q.status];
      if (actions) {
        const r = await actions.setInquiryStatus(q.id, next);
        if (!r.ok) return setNote({ bad: true, text: r.message });
      }
      setInq((l) => l.map((x) => (x.id === q.id ? { ...x, status: next } : x)));
    });

  const notify = (id: string | undefined, property: string) =>
    start(async () => {
      if (actions && id) {
        const r = await actions.notifySync(id);
        if (!r.ok) return setNote({ bad: true, text: r.message });
      }
      setNote({ bad: false, text: `${property} 사장님께 계정 재확인 알림을 보냈어요.` });
    });

  const retry = (id: string | undefined) =>
    start(async () => {
      if (!actions || !id)
        return setNote({ bad: false, text: "체험 모드라 저장되지 않아요. 실제 서비스에서는 바로 반영돼요." });
      const r = await actions.retrySync(id);
      if (!r.ok) return setNote({ bad: true, text: r.message });
      if (r.data.status === "CONNECTED") {
        setIssues((l) => l.filter((x) => x.id !== id));
        setNote({ bad: false, text: "다시 수집했어요. 연결이 정상으로 돌아왔어요." });
      } else setNote({ bad: true, text: r.data.message ?? "여전히 수집에 실패해요." });
    });

  return (
    <div className="ad">
      <PageHead
        title="운영자 백오피스"
        desc="업장·구독·채널 연동 상태를 보고 도입 문의를 처리합니다. 운영자 계정으로만 들어올 수 있어요."
      />
      <StatRow cols={4}>
        <Stat
          label="가입 업장"
          value={ov?.properties ?? data.properties.length}
          suffix="곳"
          foot={ov ? `최근 7일 +${ov.newProperties}` : "이번 달 +3"}
        />
        <Stat
          label="구독 중"
          value={subscribed}
          suffix="곳"
          foot={
            ov
              ? `유료 ${ov.payingProperties}곳, 무료 체험 ${ov.trialProperties}곳, 월 ${won(ov.monthlyRevenue)}원`
              : "온보딩 미완료 1곳"
          }
        />
        <Stat
          label="연동 오류"
          value={issues.length}
          suffix="건"
          foot={issues.length ? "재인증이 필요한 채널이 있어요" : "모든 채널 정상"}
        />
        <Stat label="새 문의" value={fresh} suffix="건" foot="24시간 안에 연락" />
      </StatRow>
      <Tabs
        items={[
          { id: "properties", label: "업장", count: data.properties.length },
          { id: "sync", label: "연동 오류", count: issues.length },
          { id: "inquiries", label: "도입·파트너 문의", count: fresh },
        ]}
        value={tab}
        onChange={setTab}
        label="백오피스 보기"
      />
      {note && <p className={note.bad ? "ad-note is-bad" : "ad-note"}>{note.text}</p>}

      {tab === "properties" && (
        <Card flush>
          <TableWrap>
            <table className="pm-table">
              <thead>
                <tr>
                  <th>업장</th>
                  <th>유형</th>
                  <th>지역</th>
                  <th>구독</th>
                  <th className="is-num">채널</th>
                  <th>연동</th>
                  <th>가입일</th>
                  <th>담당 매니저</th>
                </tr>
              </thead>
              <tbody>
                {data.properties.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>{TYPE[p.type]}</td>
                    <td className="is-muted">{p.region}</td>
                    <td>
                      {p.plans.length ? (
                        <span className="ad-plans">
                          {p.plans.map((x) => (
                            <Tag key={x}>{PLAN[x]}</Tag>
                          ))}
                        </span>
                      ) : (
                        <Badge tone="warn">온보딩 중</Badge>
                      )}
                    </td>
                    <td className="is-num">{p.channels}</td>
                    <td>
                      {p.syncErrors ? (
                        <Badge tone="bad" dot>
                          오류 {p.syncErrors}
                        </Badge>
                      ) : p.channels ? (
                        <Badge tone="ok" dot>
                          정상
                        </Badge>
                      ) : (
                        <span className="is-muted">-</span>
                      )}
                    </td>
                    <td className="num">{p.joined.replaceAll("-", ".")}</td>
                    <td>{p.manager}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      {tab === "sync" && (
        <Card flush>
          <TableWrap>
            <table className="pm-table">
              <thead>
                <tr>
                  <th>업장</th>
                  <th>채널</th>
                  <th>발생</th>
                  <th>원인</th>
                  <th>
                    <span className="pm-sr">동작</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {issues.length === 0 && (
                  <tr>
                    <td colSpan={5} className="is-muted">
                      수집이 멈춘 채널이 없어요.
                    </td>
                  </tr>
                )}
                {issues.map((s) => (
                  <tr key={s.id ?? s.property + s.channel}>
                    <td>
                      <strong>{s.property}</strong>
                    </td>
                    <td>
                      <ChannelChip channel={s.channel} name={names[s.channel]} />
                    </td>
                    <td className="num">{s.since}</td>
                    <td>{s.reason}</td>
                    <td className="is-num">
                      <span className="ad-acts">
                        <PmButton size="sm" variant="quiet" disabled={pending} onClick={() => retry(s.id)}>
                          다시 수집
                        </PmButton>
                        <PmButton size="sm" disabled={pending} onClick={() => notify(s.id, s.property)}>
                          사장님께 다시 알림
                        </PmButton>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      {tab === "inquiries" && (
        <Card flush>
          <TableWrap>
            <table className="pm-table">
              <thead>
                <tr>
                  <th>접수</th>
                  <th>구분</th>
                  <th>이름 · 업장</th>
                  <th>유형 · 객실</th>
                  <th>문의 내용</th>
                  <th>상태</th>
                  <th>
                    <span className="pm-sr">동작</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {inq.map((q) => (
                  <tr key={q.id}>
                    <td className="num">{q.at.slice(5).replace("-", ".")}</td>
                    <td>{q.kind}</td>
                    <td>
                      <strong>{q.name}</strong>
                      <small className="ad-sub">{q.property}</small>
                    </td>
                    <td>{q.rooms ? `${TYPE[q.type]} ${q.rooms}실` : "-"}</td>
                    <td className="is-wrap">{q.message}</td>
                    <td>
                      <Badge tone={STATUS[q.status].tone}>{STATUS[q.status].label}</Badge>
                    </td>
                    <td className="is-num">
                      {q.status !== "done" && (
                        <PmButton
                          size="sm"
                          variant={q.status === "new" ? "primary" : "ghost"}
                          disabled={pending}
                          onClick={() => moveInquiry(q)}
                        >
                          {q.status === "new" ? "연락함으로" : "완료로"}
                        </PmButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <p className="ad-foot">
            랜딩의 &lsquo;도입 문의하기&rsquo;·&lsquo;파트너 도입 문의&rsquo;로 접수되면 운영팀에 바로 알림이 갑니다.
          </p>
        </Card>
      )}
    </div>
  );
}
