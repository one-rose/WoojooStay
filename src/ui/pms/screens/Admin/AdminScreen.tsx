"use client";

import { useMemo, useState, useTransition } from "react";
import { formatWon } from "@/shared";
import type {
  AdminActions,
  AdminData,
  AdminPilotActions,
  AdminProperty,
  AdminPropertyActions,
  ChannelConnection,
  ChannelId,
  Inquiry,
  PropertyType,
} from "@/core";
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
import { AdminAttentionTab } from "./AdminAttentionTab";
import { AdminPilotTab } from "./AdminPilotTab";
import { AdminPropertyPanel } from "./AdminPropertyPanel";
import "./admin.css";

type Tab = "properties" | "pilot" | "attention" | "sync" | "inquiries";
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

/** "2026-11-21 08:12" → "11.21 08:12" */
const short = (t: string | null | undefined) => (t ? t.slice(5).replace("-", ".") : null);

/** 사장님 단위로 묶기 — 사장님 id(없으면 이름+번호)별 */
function byOwner(rows: readonly AdminProperty[]) {
  const groups = new Map<string, { owner: string; phone?: string; rows: AdminProperty[] }>();
  for (const r of rows) {
    const key = r.ownerId ?? `${r.owner ?? ""}|${r.ownerPhone ?? ""}`;
    const g = groups.get(key) ?? { owner: r.owner ?? "사장님 없음", phone: r.ownerPhone, rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  }
  return [...groups.entries()].sort((a, b) => b[1].rows.length - a[1].rows.length);
}

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
  actions?: AdminActions & Partial<AdminPropertyActions> & Partial<AdminPilotActions>;
}) {
  const [tab, setTab] = useState<Tab>("properties");
  const [rows, setRows] = useState(data.properties);
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState<AdminProperty | null>(null);
  const [grouped, setGrouped] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("");
  /** 업장명 · 사장님 이름 · 휴대폰 번호(숫자만 비교)로 찾기 */
  const owners = useMemo(() => byOwner(rows).filter(([, g]) => g.rows.length > 1), [rows]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "");
    const base = ownerFilter
      ? rows.filter((p) => (p.ownerId ?? `${p.owner ?? ""}|${p.ownerPhone ?? ""}`) === ownerFilter)
      : rows;
    if (!q) return base;
    const digits = q.replace(/\D/g, "");
    return base.filter(
      (p) =>
        p.name.toLowerCase().replace(/\s+/g, "").includes(q) ||
        (p.owner ?? "").replace(/\s+/g, "").includes(q) ||
        (digits.length >= 3 && (p.ownerPhone ?? "").replace(/\D/g, "").includes(digits)),
    );
  }, [rows, query, ownerFilter]);
  const detailActions: AdminPropertyActions | undefined =
    actions?.propertyDetail && actions.assignManager && actions.operators
      ? { propertyDetail: actions.propertyDetail, assignManager: actions.assignManager, operators: actions.operators }
      : undefined;
  const pilotActions: AdminPilotActions | undefined =
    actions?.setPilot && actions.saveSurvey && actions.addNote && actions.removeNote && actions.loadPilot
      ? {
          setPilot: actions.setPilot,
          saveSurvey: actions.saveSurvey,
          addNote: actions.addNote,
          removeNote: actions.removeNote,
          loadPilot: actions.loadPilot,
        }
      : undefined;
  const tableGroups: ReturnType<typeof byOwner> = grouped ? byOwner(shown) : [["", { owner: "", rows: [...shown] }]];
  const openById = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (row) setOpened(row);
    else setNote({ bad: false, text: "체험 모드 예시 업장이라 상세가 없어요." });
  };
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
        desc="업장, 구독, 채널 연동 상태를 보고 도입 문의를 처리해요. 운영자 계정으로만 들어올 수 있어요."
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
              ? `유료 ${ov.payingProperties}곳, 무료 체험 ${ov.trialProperties}곳, 월 ${formatWon(ov.monthlyRevenue)}`
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
          ...(data.pilot ? [{ id: "pilot" as const, label: "실증 KPI", count: data.pilot.properties.length }] : []),
          ...(data.attention
            ? [{ id: "attention" as const, label: "연락할 곳", count: data.attention.items.length }]
            : []),
          { id: "sync", label: "연동 오류", count: issues.length },
          { id: "inquiries", label: "도입·파트너 문의", count: fresh },
        ]}
        value={tab}
        onChange={setTab}
        label="백오피스 보기"
      />
      {note && <p className={note.bad ? "ad-note is-bad" : "ad-note"}>{note.text}</p>}

      {tab === "properties" && (
        <div className="ad-search">
          <input
            type="search"
            className="pm-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="업장명, 사장님 이름, 휴대폰 번호로 찾기"
            aria-label="업장 찾기"
          />
          {owners.length > 0 && (
            <select
              className="pm-input ad-search__owner"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              aria-label="사장님으로 거르기"
            >
              <option value="">사장님 전체</option>
              {owners.map(([key, g]) => (
                <option key={key} value={key}>
                  {g.owner} ({g.rows.length}곳)
                </option>
              ))}
            </select>
          )}
          <label className="ad-search__group">
            <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} /> 사장님별로 묶기
          </label>
          {(query.trim() || ownerFilter) && <span className="num">{shown.length}곳</span>}
        </div>
      )}
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
                  <th>활성화</th>
                  <th>최근 접속</th>
                  <th>가입일</th>
                  <th>담당 매니저</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={10} className="is-muted">
                      찾는 업장이 없어요.
                    </td>
                  </tr>
                )}
                {tableGroups.map(([key, g]) => [
                  grouped && (
                    <tr key={`g-${key}`} className="ad-group">
                      <th colSpan={10} scope="rowgroup">
                        {g.owner}
                        {g.phone && (
                          <span className="num"> {g.phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3")}</span>
                        )}
                        <span className="ad-group__n num">{g.rows.length}곳</span>
                      </th>
                    </tr>
                  ),
                  ...g.rows.map((p) => (
                    <tr key={p.id} className="ad-row" onClick={() => setOpened(p)}>
                      <td>
                        <button
                          type="button"
                          className="ad-row__open"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpened(p);
                          }}
                        >
                          <strong>{p.name}</strong>
                        </button>
                        {p.owner && !grouped && <small className="ad-sub">{p.owner}</small>}
                        {p.pilotGroup && <small className="ad-sub">실증 {p.pilotGroup}</small>}
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
                          <span className="is-muted">정상</span>
                        ) : (
                          <span className="is-muted">-</span>
                        )}
                      </td>
                      <td>
                        {!p.activation ? (
                          <span className="is-muted">-</span>
                        ) : p.activation.blocked ? (
                          <span className="ad-stage">
                            <Badge tone="warn">
                              {p.activation.steps.find((x) => x.key === p.activation?.blocked)?.label} 전
                            </Badge>
                          </span>
                        ) : (
                          <span className="is-muted">첫 답글까지</span>
                        )}
                      </td>
                      <td className="num is-muted">
                        {short(p.lastLoginOwner) ?? (p.ownerId ? "접속 없음" : "-")}
                        {p.lastLoginManager && <small className="ad-sub">매니저 {short(p.lastLoginManager)}</small>}
                      </td>
                      <td className="num">{p.joined.replaceAll("-", ".")}</td>
                      <td>{p.manager}</td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      {opened && (
        <AdminPropertyPanel
          row={opened}
          channels={channels}
          actions={detailActions}
          pilotActions={pilotActions}
          onPilotChange={(id, group) => setRows((l) => l.map((x) => (x.id === id ? { ...x, pilotGroup: group } : x)))}
          onClose={() => setOpened(null)}
          onManagerChange={(id, name) => setRows((l) => l.map((x) => (x.id === id ? { ...x, manager: name } : x)))}
        />
      )}

      {tab === "pilot" && data.pilot && <AdminPilotTab kpi={data.pilot} actions={pilotActions} />}
      {tab === "attention" && data.attention && <AdminAttentionTab data={data.attention} onOpen={openById} />}

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
                  <th>보낸 사람</th>
                  <th>업장 규모</th>
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
                        <PmButton size="sm" variant="ghost" disabled={pending} onClick={() => moveInquiry(q)}>
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
