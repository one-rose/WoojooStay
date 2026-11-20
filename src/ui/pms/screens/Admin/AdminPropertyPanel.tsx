"use client";

import { useEffect, useState, useTransition } from "react";
import type {
  AdminOperator,
  AdminPilotActions,
  AdminProperty,
  AdminPropertyActions,
  AdminPropertyDetail,
  AdminSupportNote,
  AdminSupportNoteKind,
  ChannelConnection,
  PropertyType,
} from "@/core";
import { formatNumber } from "@/shared";
import { Badge, ChannelChip, Modal, PmButton, type BadgeTone } from "../../components";

const TYPE: Record<PropertyType, string> = {
  hotel: "호텔",
  motel: "모텔",
  pension: "펜션",
  guesthouse: "게스트하우스",
};
const ROLE = { owner: "사장님", manager: "매니저", staff: "직원" } as const;
const SUB: Record<string, { tone: BadgeTone; label: string }> = {
  TRIAL: { tone: "info", label: "무료 체험" },
  ACTIVE: { tone: "ok", label: "이용 중" },
  PAST_DUE: { tone: "bad", label: "결제 실패" },
  CANCELLED: { tone: "neutral", label: "해지" },
};
const SYNC: Record<string, { tone: BadgeTone; label: string }> = {
  CONNECTED: { tone: "ok", label: "정상" },
  SYNCING: { tone: "info", label: "수집 중" },
  AUTH_EXPIRED: { tone: "bad", label: "다시 로그인 필요" },
  ERROR: { tone: "bad", label: "수집 오류" },
};
const NOTE_KIND: Record<AdminSupportNoteKind, string> = { CALL: "통화", VISIT: "방문", ETC: "기타" };
const PAY: Record<string, { tone: BadgeTone; label: string }> = {
  PAID: { tone: "ok", label: "결제됨" },
  FAILED: { tone: "bad", label: "실패" },
  REFUNDED: { tone: "neutral", label: "환불" },
};

/** 01012345678 → 010-1234-5678 */
const phone = (p: string) => p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
/** 1234567890 → 123-45-67890 */
const bizNo = (b: string) => b.replace(/^(\d{3})(\d{2})(\d{5})$/, "$1-$2-$3");

/**
 * 운영자 업장 상세 — 사장님·연락처·구성원·채널·구독·결제를 한 번에, 담당 운영자 지정.
 * actions 가 없으면(체험 모드) 목록에 있는 정보만 보여 준다.
 */
export function AdminPropertyPanel({
  row,
  channels,
  actions,
  pilotActions,
  onClose,
  onManagerChange,
  onPilotChange,
}: {
  row: AdminProperty;
  channels: readonly ChannelConnection[];
  actions?: AdminPropertyActions;
  pilotActions?: AdminPilotActions;
  /** 실증 지정·해제 뒤 목록 칸도 바꾼다 */
  onPilotChange?: (propertyId: string, group: string | null) => void;
  onClose: () => void;
  /** 담당 운영자를 바꾼 뒤 목록 칸도 바꾼다 */
  onManagerChange: (propertyId: string, managerName: string) => void;
}) {
  const [detail, setDetail] = useState<AdminPropertyDetail | null>(null);
  const [operators, setOperators] = useState<AdminOperator[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [managerId, setManagerId] = useState<string>("");
  const [pending, start] = useTransition();
  const [pilotGroup, setPilotGroup] = useState("");
  const [pilotStart, setPilotStart] = useState("");
  const [pilotNote, setPilotNote] = useState("");
  const [notes, setNotes] = useState<readonly AdminSupportNote[]>([]);
  const [noteKind, setNoteKind] = useState<AdminSupportNoteKind>("CALL");
  const [noteBody, setNoteBody] = useState("");

  useEffect(() => {
    if (!actions) return;
    let alive = true;
    Promise.all([actions.propertyDetail(row.id), actions.operators()]).then(([d, o]) => {
      if (!alive) return;
      if (!d.ok) return setError(d.message);
      setDetail(d.data);
      setManagerId(d.data.manager?.id ?? "");
      setPilotGroup(d.data.pilot?.group ?? "");
      setPilotStart(d.data.pilot?.startedAt ?? "");
      setNotes(d.data.notes ?? []);
      if (o.ok) setOperators(o.data.filter((x) => x.active || x.id === d.data.manager?.id));
    });
    return () => {
      alive = false;
    };
  }, [actions, row.id]);

  const saveManager = () =>
    start(async () => {
      if (!actions) return;
      setNote("");
      const r = await actions.assignManager(row.id, managerId || null);
      if (!r.ok) return setError(r.message);
      setError("");
      setDetail(r.data);
      onManagerChange(row.id, r.data.manager?.name ?? "미지정");
      setNote(r.data.manager ? `담당 운영자를 ${r.data.manager.name}님으로 정했어요.` : "담당 운영자를 비웠어요.");
    });

  const savePilot = (clear: boolean) =>
    start(async () => {
      if (!pilotActions) return;
      setPilotNote("");
      const group = clear ? null : pilotGroup.trim() || null;
      const r = await pilotActions.setPilot(row.id, group, group ? pilotStart || undefined : undefined);
      if (!r.ok) return setError(r.message);
      setError("");
      const d = actions ? await actions.propertyDetail(row.id) : null;
      if (d?.ok) {
        setDetail(d.data);
        setPilotGroup(d.data.pilot?.group ?? "");
        setPilotStart(d.data.pilot?.startedAt ?? "");
      }
      onPilotChange?.(row.id, group);
      setPilotNote(group ? `실증 ${group} 업장으로 정했어요. 실증 기간에는 결제하지 않아요.` : "실증 업장에서 뺐어요.");
    });

  const addNote = () =>
    start(async () => {
      if (!pilotActions || !noteBody.trim()) return;
      const r = await pilotActions.addNote(row.id, noteKind, noteBody.trim());
      if (!r.ok) return setError(r.message);
      setError("");
      setNotes((l) => [r.data, ...l]);
      setNoteBody("");
    });

  const removeNote = (id: string) =>
    start(async () => {
      if (!pilotActions) return;
      const r = await pilotActions.removeNote(row.id, id);
      if (!r.ok) return setError(r.message);
      setNotes((l) => l.filter((n) => n.id !== id));
    });

  const owners = detail?.members.filter((m) => m.role === "owner") ?? [];
  const chName = (id: string, fallback: string) => channels.find((c) => c.channel === id)?.name ?? fallback;
  const managerChanged = detail && managerId !== (detail.manager?.id ?? "");

  return (
    <Modal
      title={row.name}
      desc={`${TYPE[row.type]}, ${detail ? `${detail.rooms}실, ` : ""}${detail?.address ?? row.region}`}
      wide
      onClose={onClose}
      footer={
        <PmButton variant="ghost" onClick={onClose}>
          닫기
        </PmButton>
      }
    >
      {!actions && <p className="ad-detail__muted">체험 모드에서는 목록에 있는 정보만 보여요.</p>}
      {actions && !detail && !error && <p className="ad-detail__muted">불러오는 중…</p>}
      {error && (
        <p className="ad-note is-bad" role="alert">
          {error}
        </p>
      )}

      {detail && (
        <>
          <section className="ad-detail__sec">
            <h3>사장님</h3>
            <dl className="ad-detail__kv">
              <div>
                <dt>대표자</dt>
                <dd>{detail.ownerName}</dd>
              </div>
              {owners.map((o) => (
                <div key={o.phone}>
                  <dt>사장님 계정</dt>
                  <dd>
                    {o.name} <span className="num">{phone(o.phone)}</span>
                  </dd>
                </div>
              ))}
              <div>
                <dt>사업자등록번호</dt>
                <dd>
                  <span className="num">{bizNo(detail.bizNo)}</span>{" "}
                  {!detail.bizVerified && <Badge tone="warn">국세청 확인 전</Badge>}
                </dd>
              </div>
              <div>
                <dt>가입일</dt>
                <dd className="num">{detail.joined.replaceAll("-", ".")}</dd>
              </div>
            </dl>
          </section>

          <section className="ad-detail__sec">
            <h3>담당 운영자</h3>
            <div className="ad-detail__assign">
              <select
                className="pm-input"
                value={managerId}
                onChange={(e) => {
                  setManagerId(e.target.value);
                  setNote("");
                }}
                aria-label="담당 운영자"
              >
                <option value="">지정 안 함</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.email})
                  </option>
                ))}
              </select>
              <PmButton variant="navy" size="sm" disabled={pending || !managerChanged} onClick={saveManager}>
                {pending ? "저장 중…" : "저장"}
              </PmButton>
            </div>
            {note && (
              <p className="ad-detail__ok" role="status">
                {note}
              </p>
            )}
          </section>

          <section className="ad-detail__sec">
            <h3>실증</h3>
            <div className="ad-detail__assign">
              <input
                className="pm-input"
                value={pilotGroup}
                onChange={(e) => {
                  setPilotGroup(e.target.value);
                  setPilotNote("");
                }}
                placeholder="묶음 이름 (예: 대전 1차)"
                aria-label="실증 묶음 이름"
                maxLength={30}
                disabled={!pilotActions}
              />
              <input
                type="date"
                className="pm-input ad-detail__date"
                value={pilotStart}
                onChange={(e) => setPilotStart(e.target.value)}
                aria-label="실증 시작일"
                disabled={!pilotActions}
              />
              <PmButton
                size="sm"
                variant="ghost"
                disabled={pending || !pilotActions || !pilotGroup.trim()}
                onClick={() => savePilot(false)}
              >
                {detail.pilot ? "바꾸기" : "실증 업장으로"}
              </PmButton>
              {detail.pilot && (
                <PmButton size="sm" variant="quiet" disabled={pending} onClick={() => savePilot(true)}>
                  해제
                </PmButton>
              )}
            </div>
            <p className="ad-detail__muted">
              {detail.pilot
                ? `${detail.pilot.startedAt.replaceAll("-", ".")}부터 ${detail.pilot.endsAt.replaceAll("-", ".")}까지 8주. 이 기간에는 결제하지 않고 요금·재고 메뉴를 숨겨요.`
                : "시작일을 비우면 오늘부터예요. 실증 기간(8주)에는 결제하지 않아요."}
            </p>
            {pilotNote && (
              <p className="ad-detail__ok" role="status">
                {pilotNote}
              </p>
            )}
          </section>

          {detail.activation && (
            <section className="ad-detail__sec">
              <h3>활성화 단계</h3>
              <ol className="ad-steps">
                {detail.activation.steps.map((st) => (
                  <li
                    key={st.key}
                    className={st.done ? "is-done" : st.key === detail.activation?.blocked ? "is-blocked" : ""}
                  >
                    <span>{st.label}</span>
                    <small className="num">
                      {st.done
                        ? (st.at?.slice(5, 10).replace("-", ".") ?? "")
                        : st.key === detail.activation?.blocked
                          ? "여기서 멈춤"
                          : ""}
                    </small>
                  </li>
                ))}
              </ol>
              {detail.activation.blocked && detail.activation.stuckSince && (
                <p className="ad-detail__muted num">
                  {detail.activation.stuckSince.replaceAll("-", ".")}부터 다음 단계로 못 가고 있어요.
                </p>
              )}
            </section>
          )}

          <section className="ad-detail__sec">
            <h3>구성원 {detail.members.length}명</h3>
            <table className="pm-table ad-detail__table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>권한</th>
                  <th>휴대폰</th>
                  <th>마지막 로그인</th>
                </tr>
              </thead>
              <tbody>
                {detail.members.map((m) => (
                  <tr key={`${m.phone}-${m.role}`}>
                    <td>{m.name}</td>
                    <td>{ROLE[m.role]}</td>
                    <td className="num">{phone(m.phone)}</td>
                    <td className="num is-muted">{m.lastLoginAt ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="ad-detail__sec">
            <h3>채널 {detail.channels.length}곳</h3>
            {detail.channels.length === 0 ? (
              <p className="ad-detail__muted">연결한 채널이 없어요.</p>
            ) : (
              <table className="pm-table ad-detail__table">
                <thead>
                  <tr>
                    <th>채널</th>
                    <th>상태</th>
                    <th>마지막 수집</th>
                    <th>오류</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.channels.map((c) => {
                    const st = SYNC[c.status] ?? { tone: "neutral" as const, label: c.status };
                    return (
                      <tr key={c.channel}>
                        <td>
                          <ChannelChip channel={c.channel} name={chName(c.channel, c.name)} />
                        </td>
                        <td>
                          <Badge tone={st.tone} dot>
                            {st.label}
                          </Badge>
                        </td>
                        <td className="num is-muted">{c.lastSyncedAt ?? "첫 수집 전"}</td>
                        <td className="is-wrap">
                          {c.lastError ??
                            (c.fails > 0 ? `연속 실패 ${c.fails}회` : <span className="is-muted">-</span>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="ad-detail__sec">
            <h3>구독</h3>
            {detail.subscriptions.length === 0 ? (
              <p className="ad-detail__muted">고른 상품이 없어요 (온보딩 중).</p>
            ) : (
              <ul className="ad-detail__subs">
                {detail.subscriptions.map((s) => {
                  const st = SUB[s.status] ?? { tone: "neutral" as const, label: s.status };
                  return (
                    <li key={s.name}>
                      <strong>{s.name}</strong>
                      <span className="num">월 {formatNumber(s.monthlyPrice)}원</span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {s.status === "TRIAL" && s.trialEndsAt && (
                        <span className="ad-detail__muted num">{s.trialEndsAt.replaceAll("-", ".")}까지</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {detail.aiUsage && detail.aiUsage.some((u) => u.drafts + u.regenerations + u.posts > 0) && (
            <section className="ad-detail__sec">
              <h3>AI 답글 사용량</h3>
              <table className="pm-table ad-detail__table">
                <thead>
                  <tr>
                    <th>월</th>
                    <th className="is-num">초안 생성</th>
                    <th className="is-num">다시 쓰기</th>
                    <th className="is-num">답글 게시</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.aiUsage.map((u) => (
                    <tr key={u.month}>
                      <td className="num">{u.month.replace("-", ".")}</td>
                      <td className="is-num">{formatNumber(u.drafts)}</td>
                      <td className="is-num">{formatNumber(u.regenerations)}</td>
                      <td className="is-num">{formatNumber(u.posts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="ad-detail__sec">
            <h3>지원 메모 {notes.length > 0 && <span className="num">{notes.length}</span>}</h3>
            {pilotActions && (
              <div className="ad-notes__form">
                <select
                  className="pm-input"
                  value={noteKind}
                  onChange={(e) => setNoteKind(e.target.value as AdminSupportNoteKind)}
                  aria-label="메모 종류"
                >
                  <option value="CALL">통화</option>
                  <option value="VISIT">방문</option>
                  <option value="ETC">기타</option>
                </select>
                <textarea
                  className="pm-input"
                  rows={2}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="통화·방문 내용을 남겨 주세요"
                  aria-label="메모 내용"
                  maxLength={2000}
                />
                <PmButton size="sm" variant="ghost" disabled={pending || !noteBody.trim()} onClick={addNote}>
                  남기기
                </PmButton>
              </div>
            )}
            {notes.length === 0 ? (
              <p className="ad-detail__muted">남긴 메모가 없어요.</p>
            ) : (
              <ul className="ad-notes">
                {notes.map((n) => (
                  <li key={n.id}>
                    <div className="ad-notes__meta">
                      <strong>{NOTE_KIND[n.kind]}</strong>
                      <span className="num">{n.at.replaceAll("-", ".")}</span>
                      <span>{n.admin?.name ?? "삭제된 운영자"}</span>
                      {pilotActions && (
                        <button
                          type="button"
                          className="ad-notes__del"
                          onClick={() => removeNote(n.id)}
                          disabled={pending}
                        >
                          지우기
                        </button>
                      )}
                    </div>
                    <p>{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ad-detail__sec">
            <h3>최근 결제</h3>
            {detail.payments.length === 0 ? (
              <p className="ad-detail__muted">결제 기록이 없어요.</p>
            ) : (
              <table className="pm-table ad-detail__table">
                <thead>
                  <tr>
                    <th>청구 월</th>
                    <th>내용</th>
                    <th className="is-num">금액</th>
                    <th>결과</th>
                    <th>처리 시각</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.payments.map((p) => {
                    const st = PAY[p.status] ?? { tone: "neutral" as const, label: p.status };
                    return (
                      <tr key={p.id}>
                        <td className="num">{p.month.replace("-", ".")}</td>
                        <td>{p.description}</td>
                        <td className="is-num">{formatNumber(p.amount)}원</td>
                        <td>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </td>
                        <td className="num is-muted">{p.paidAt}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {!actions && (
        <dl className="ad-detail__kv">
          <div>
            <dt>지역</dt>
            <dd>{row.region}</dd>
          </div>
          <div>
            <dt>연결 채널</dt>
            <dd className="num">{row.channels}곳</dd>
          </div>
          <div>
            <dt>담당 운영자</dt>
            <dd>{row.manager}</dd>
          </div>
          <div>
            <dt>가입일</dt>
            <dd className="num">{row.joined.replaceAll("-", ".")}</dd>
          </div>
        </dl>
      )}
    </Modal>
  );
}
