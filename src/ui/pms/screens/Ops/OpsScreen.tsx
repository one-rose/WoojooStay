"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ROOM_NEXT,
  ROOM_STATUSES,
  floorOf,
  parseRoomNumbers,
  type ActionResult,
  type OpsActions,
  type OpsData,
  type OpsNote,
  type RoomLog,
  type RoomStatus,
  type RoomUnit,
} from "@/core";
import { cx, josa } from "@/shared";
import { Badge, Card, Field, Icon, Modal, PageHead, PmButton } from "../../components";
import { NEXT_LABEL, ROOM_LABEL, SHIFT_LABEL, ago, dayLabel, hm } from "./ops-format";
import "./ops.css";

/** 예시 데이터의 시각은 오후 2시 5분 기준 */
const sampleNow = (date: string) => Date.parse(`${date}T14:05:00+09:00`);

type Run = (fn: () => Promise<ActionResult<unknown>>, done: string, after?: () => void) => void;

/**
 * 현장 업무 (F7-01 객실 상태판 · F7-02 인수인계 · F7-03 공지)
 * 프런트·하우스키핑·사장님이 같은 판을 보고, 구두 전달 대신 기록으로 교대한다.
 * actions 가 없으면 예시 화면.
 */
export function OpsScreen({ data, actions }: { data: OpsData; actions?: OpsActions }) {
  const router = useRouter();
  const [rooms, setRooms] = useState(data.rooms);
  const [filter, setFilter] = useState<RoomStatus | "all">("all");
  const [open, setOpen] = useState<RoomUnit | null>(null);
  const [dialog, setDialog] = useState<"rooms" | "notice" | null>(null);
  const [note, setNote] = useState<{ bad: boolean; text: string } | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const lead = data.myRole !== "staff";

  // 서버에서 새 데이터가 오면(router.refresh) 화면에서 바꿔 둔 값을 버리고 다시 맞춘다
  const [base, setBase] = useState(data.rooms);
  if (base !== data.rooms) {
    setBase(data.rooms);
    setRooms(data.rooms);
  }
  useEffect(() => {
    const tick = () => setNow(actions ? Date.now() : sampleNow(data.date));
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [actions, data.date]);

  const run: Run = (fn, done, after) =>
    start(async () => {
      if (!actions) {
        after?.();
        return setNote({ bad: false, text: "체험 모드라 저장되지 않아요. 실제 서비스에서는 바로 반영돼요." });
      }
      const r = await fn();
      if (!r.ok) {
        setNote({ bad: true, text: r.message });
        // 다른 사람이 먼저 바꿨으면(409) 최신 상태로 다시 불러온다
        if (r.status === 409) {
          setOpen(null);
          router.refresh();
        }
        return;
      }
      after?.();
      setNote({ bad: false, text: done });
      router.refresh();
    });

  const counts = useMemo(
    () => Object.fromEntries(ROOM_STATUSES.map((s) => [s, rooms.filter((r) => r.status === s).length])),
    [rooms],
  ) as Record<RoomStatus, number>;

  const floors = useMemo(() => {
    const shown = filter === "all" ? rooms : rooms.filter((r) => r.status === filter);
    const map = new Map<string, RoomUnit[]>();
    for (const r of shown) {
      const key = r.floor === null ? "기타" : `${r.floor}F`;
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [rooms, filter]);

  /** 화면 먼저 바꾸고(낙관적) 서버에 저장 */
  const changeStatus = (room: RoomUnit, status: RoomStatus, memo: string | null, after?: () => void) => {
    const label = ROOM_LABEL[status].label;
    run(
      () => actions!.setRoomStatus(room.id, status, memo ?? undefined),
      room.status === status
        ? `${room.number}호 메모를 저장했어요.`
        : `${room.number}호를 '${label}'${josa(label, "으로/로").slice(label.length)} 바꿨어요.`,
      () => {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === room.id
              ? {
                  ...r,
                  status,
                  memo,
                  ...(r.status !== status
                    ? { changedAt: new Date(now ?? sampleNow(data.date)).toISOString(), changedBy: "나" }
                    : {}),
                }
              : r,
          ),
        );
        after?.();
      },
    );
  };

  const toFix = counts.dirty + counts.cleaning + counts.inspect;

  return (
    <div className="op">
      <PageHead
        title="현장 업무"
        desc="객실 청소·점검 상태와 교대 인수인계를 한 판에서 봐요. 프런트와 하우스키핑이 말 대신 기록으로 넘겨요."
        actions={
          <>
            {lead && (
              <PmButton icon="door" onClick={() => setDialog("rooms")}>
                객실 등록
              </PmButton>
            )}
            <PmButton
              variant="primary"
              icon="edit"
              onClick={() => {
                const el = document.getElementById("op-handover-text");
                if (!el) return;
                const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
                el.focus({ preventScroll: true });
              }}
            >
              인수인계 쓰기
            </PmButton>
          </>
        }
      />
      {note && (
        <p className={cx("op-msg", note.bad && "is-bad")} role={note.bad ? "alert" : "status"}>
          {note.text}
        </p>
      )}

      <div className="op-layout">
        <Card className="op-board" title="객실 상태" meta={rooms.length ? `손이 가야 하는 객실 ${toFix}실` : undefined}>
          {rooms.length === 0 ? (
            <div className="op-empty">
              <Icon name="door" size={28} />
              <strong>아직 등록한 객실이 없어요</strong>
              <p>호수를 등록하면 청소 필요 → 청소 중 → 점검 대기 → 판매 가능 순서로 상태를 관리할 수 있어요.</p>
              {lead && (
                <PmButton variant="navy" icon="door" onClick={() => setDialog("rooms")}>
                  객실 등록
                </PmButton>
              )}
            </div>
          ) : (
            <>
              <div className="op-filter" role="group" aria-label="상태로 걸러 보기">
                <button
                  type="button"
                  className={cx("op-filter__btn", filter === "all" && "is-on")}
                  onClick={() => setFilter("all")}
                >
                  전체 <span className="num">{rooms.length}</span>
                </button>
                {ROOM_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={cx("op-filter__btn", `is-${s}`, filter === s && "is-on")}
                    onClick={() => setFilter(filter === s ? "all" : s)}
                    aria-pressed={filter === s}
                  >
                    <i aria-hidden />
                    {ROOM_LABEL[s].label} <span className="num">{counts[s]}</span>
                  </button>
                ))}
              </div>
              {floors.length === 0 && <p className="op-none">이 상태인 객실이 없어요.</p>}
              {floors.map(([floor, list]) => (
                <section key={floor} className="op-floor" aria-label={floor}>
                  <h3 className="op-floor__label num">{floor}</h3>
                  <ul className="op-rooms">
                    {list.map((r) => (
                      <li key={r.id}>
                        <button type="button" className={cx("op-room", `is-${r.status}`)} onClick={() => setOpen(r)}>
                          <span className="op-room__no num">{r.number}</span>
                          <span className="op-room__type">{r.roomType ?? " "}</span>
                          <span className="op-room__status">{ROOM_LABEL[r.status].short}</span>
                          <span className="op-room__meta">
                            <span>{ago(r.changedAt, now)}</span>
                            {r.changedBy && <span>{r.changedBy}</span>}
                          </span>
                          {r.memo && (
                            <span className="op-room__memo" title={r.memo}>
                              <Icon name="edit" size={12} />
                              {r.memo}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )}
        </Card>

        <div className="op-side">
          <NoticeCard
            data={data}
            lead={lead}
            pending={pending}
            run={run}
            actions={actions}
            onWrite={() => setDialog("notice")}
          />
          <HandoverCard data={data} lead={lead} pending={pending} run={run} actions={actions} />
        </div>
      </div>

      {open && (
        <RoomDialog
          room={open}
          lead={lead}
          pending={pending}
          now={now}
          roomLogs={actions?.roomLogs}
          onClose={() => setOpen(null)}
          onSave={(status, memo) => changeStatus(open, status, memo, () => setOpen(null))}
        />
      )}
      {dialog === "rooms" && (
        <AddRoomsDialog
          existing={rooms.map((r) => r.number)}
          pending={pending}
          onClose={() => setDialog(null)}
          onSubmit={(list) =>
            run(
              () => actions!.addRooms(list),
              `객실 ${list.length}개를 등록했어요.`,
              () => setDialog(null),
            )
          }
        />
      )}
      {dialog === "notice" && (
        <NoticeDialog
          pending={pending}
          onClose={() => setDialog(null)}
          onSubmit={(body, pinned) =>
            run(
              () => actions!.addNote({ kind: "notice", body, pinned }),
              "공지를 올렸어요.",
              () => setDialog(null),
            )
          }
        />
      )}
    </div>
  );
}

/* ── 공지 (F7-03) ── */

function NoticeCard({
  data,
  lead,
  pending,
  run,
  actions,
  onWrite,
}: {
  data: OpsData;
  lead: boolean;
  pending: boolean;
  run: Run;
  actions?: OpsActions;
  onWrite: () => void;
}) {
  return (
    <Card
      title="공지"
      meta={data.notices.length ? `${data.notices.length}건` : undefined}
      action={
        lead && (
          <PmButton size="sm" variant="quiet" icon="edit" onClick={onWrite}>
            공지 쓰기
          </PmButton>
        )
      }
    >
      {data.notices.length === 0 ? (
        <p className="op-none">올린 공지가 없어요.</p>
      ) : (
        <ul className="op-notes">
          {data.notices.map((n) => (
            <NoteItem key={n.id} n={n} data={data} lead={lead} pending={pending} run={run} actions={actions} />
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── 인수인계 (F7-02) ── */

function HandoverCard({
  data,
  lead,
  pending,
  run,
  actions,
}: {
  data: OpsData;
  lead: boolean;
  pending: boolean;
  run: Run;
  actions?: OpsActions;
}) {
  const [text, setText] = useState("");
  const [shift, setShift] = useState<"day" | "night">("day");
  const groups = useMemo(() => {
    const map = new Map<string, OpsNote[]>();
    for (const n of data.handovers) {
      const k = dayLabel(n.createdAt, data.date);
      map.set(k, [...(map.get(k) ?? []), n]);
    }
    return [...map.entries()];
  }, [data.handovers, data.date]);

  return (
    <Card title="인수인계" meta="최근 7일">
      <form
        className="op-compose"
        onSubmit={(e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body) return;
          run(
            () => actions!.addNote({ kind: "handover", body, shift }),
            "인수인계를 남겼어요. 다음 근무자가 확인하면 표시돼요.",
            () => setText(""),
          );
        }}
      >
        <textarea
          id="op-handover-text"
          aria-label="인수인계 내용"
          className="pm-input op-compose__text"
          rows={3}
          maxLength={2000}
          placeholder="다음 근무자에게 넘길 일 — 고객 요청, 고장, 분실물, 미결 예약…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="op-compose__row">
          <div className="op-seg" role="radiogroup" aria-label="근무">
            {(["day", "night"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={shift === s}
                className={cx("op-seg__btn", shift === s && "is-on")}
                onClick={() => setShift(s)}
              >
                {SHIFT_LABEL[s]} 근무
              </button>
            ))}
          </div>
          <PmButton type="submit" size="sm" variant="navy" disabled={pending || !text.trim()}>
            남기기
          </PmButton>
        </div>
      </form>
      {groups.length === 0 && <p className="op-none">최근 7일 인수인계가 없어요.</p>}
      {groups.map(([day, list]) => (
        <section key={day} className="op-day">
          <h3 className="op-day__label">{day}</h3>
          <ul className="op-notes">
            {list.map((n) => (
              <NoteItem key={n.id} n={n} data={data} lead={lead} pending={pending} run={run} actions={actions} />
            ))}
          </ul>
        </section>
      ))}
    </Card>
  );
}

function NoteItem({
  n,
  data,
  lead,
  pending,
  run,
  actions,
}: {
  n: OpsNote;
  data: OpsData;
  lead: boolean;
  pending: boolean;
  run: Run;
  actions?: OpsActions;
}) {
  const [read, setRead] = useState(n.readByMe);
  const readers = n.readers.map((r) => r.name).join(", ");
  const count = n.readers.length + (read && !n.readByMe ? 1 : 0);
  return (
    <li className={cx("op-note", !read && "is-unread", n.pinned && "is-pinned")}>
      <div className="op-note__head">
        {n.pinned && (
          <span className="op-note__pin" title="맨 위 고정">
            <Icon name="pin" size={14} />
          </span>
        )}
        {n.shift && <Badge tone={n.shift === "night" ? "info" : "neutral"}>{SHIFT_LABEL[n.shift]}</Badge>}
        <strong>{n.author}</strong>
        <time className="num" dateTime={n.createdAt}>
          {n.kind === "notice" ? `${dayLabel(n.createdAt, data.date)} ` : ""}
          {hm(n.createdAt)}
        </time>
        {(n.isMine || lead) && (
          <span className="op-note__tools">
            {lead && n.kind === "notice" && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => actions!.pinNote(n.id, !n.pinned), n.pinned ? "고정을 풀었어요." : "맨 위에 고정했어요.")
                }
              >
                {n.pinned ? "고정 해제" : "고정"}
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm("이 글을 지울까요? 되돌릴 수 없어요."))
                  run(() => actions!.removeNote(n.id), "글을 지웠어요.");
              }}
            >
              지우기
            </button>
          </span>
        )}
      </div>
      <p className="op-note__body">{n.body}</p>
      <div className="op-note__foot">
        <span className="op-note__readers" title={readers ? `확인: ${readers}` : undefined}>
          <Icon name="check" size={13} />
          확인 <span className="num">{count}</span>/<span className="num">{data.memberCount}</span>
        </span>
        {!read && (
          <PmButton
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(
                () => actions!.readNote(n.id),
                "확인 표시를 남겼어요.",
                () => setRead(true),
              )
            }
          >
            확인했어요
          </PmButton>
        )}
      </div>
    </li>
  );
}

/* ── 객실 상세 · 상태 바꾸기 ── */

function RoomDialog({
  room,
  lead,
  pending,
  now,
  roomLogs,
  onClose,
  onSave,
}: {
  room: RoomUnit;
  lead: boolean;
  pending: boolean;
  now: number | null;
  /** 서버 동작(참조가 바뀌지 않음) — 객실이 바뀔 때만 다시 불러온다 */
  roomLogs?: OpsActions["roomLogs"];
  onClose: () => void;
  onSave: (status: RoomStatus, memo: string | null) => void;
}) {
  const [status, setStatus] = useState(room.status);
  const [memo, setMemo] = useState(room.memo ?? "");
  const [logs, setLogs] = useState<RoomLog[] | null>(null);
  const next = ROOM_NEXT[room.status];
  const locked = !lead && room.status === "outOfOrder";
  const changed = status !== room.status || (memo.trim() || null) !== room.memo;

  const roomId = room.id;
  useEffect(() => {
    let alive = true;
    if (roomLogs)
      roomLogs(roomId).then((r) => {
        if (alive) setLogs(r.ok ? r.data : []);
      });
    return () => {
      alive = false;
    };
  }, [roomId, roomLogs]);

  return (
    <Modal
      title={`${room.number}호`}
      desc={[room.floor !== null ? `${room.floor}층` : null, room.roomType].filter(Boolean).join(" ") || undefined}
      onClose={onClose}
      footer={
        <>
          <PmButton variant="ghost" onClick={onClose}>
            닫기
          </PmButton>
          <PmButton
            variant="navy"
            disabled={pending || !changed || locked}
            onClick={() => onSave(status, memo.trim() || null)}
          >
            {pending ? "저장 중…" : "변경 저장"}
          </PmButton>
        </>
      }
    >
      <div className="op-dlg__now">
        <Badge tone={ROOM_LABEL[room.status].tone}>{ROOM_LABEL[room.status].label}</Badge>
        <span>{ago(room.changedAt, now)}</span>
        {room.changedBy && <span>{room.changedBy}</span>}
      </div>
      {next && !locked && (
        <PmButton
          variant="navy"
          className="op-dlg__next"
          icon="check"
          disabled={pending}
          autoFocus
          onClick={() => onSave(next, memo.trim() || null)}
        >
          {NEXT_LABEL[room.status]}
        </PmButton>
      )}
      {locked && <p className="op-dlg__lock">판매 중지 객실은 사장님·매니저만 상태를 바꿀 수 있어요.</p>}
      <Field label="상태 직접 고르기">
        <div className="op-dlg__grid" role="radiogroup" aria-label="객실 상태">
          {ROOM_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={status === s}
              disabled={locked || (!lead && s === "outOfOrder")}
              className={cx("op-dlg__opt", `is-${s}`, status === s && "is-on")}
              onClick={() => setStatus(s)}
            >
              <i aria-hidden />
              {ROOM_LABEL[s].label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="메모" hint="고장·고객 요청 등 다음 사람이 알아야 할 것 (비우면 지워져요)">
        <input className="pm-input" maxLength={200} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>
      {roomLogs && (
        <div className="op-dlg__logs">
          <p className="op-dlg__logs-title">
            <Icon name="history" size={14} /> 최근 기록
          </p>
          {logs === null ? (
            <p className="op-none">불러오는 중…</p>
          ) : logs.length === 0 ? (
            <p className="op-none">아직 기록이 없어요.</p>
          ) : (
            <ol>
              {logs.slice(0, 8).map((l) => (
                <li key={l.at}>
                  <time className="num">{ago(l.at, now)}</time>
                  <span>
                    {l.from ? `${ROOM_LABEL[l.from].label} → ` : ""}
                    <strong>{ROOM_LABEL[l.to].label}</strong>
                    {l.memo && <em>{l.memo}</em>}
                  </span>
                  <span className="op-dlg__by">{l.by ?? ""}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Modal>
  );
}

function AddRoomsDialog({
  existing,
  pending,
  onClose,
  onSubmit,
}: {
  existing: readonly string[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (rooms: { number: string; floor?: number; roomType?: string }[]) => void;
}) {
  const [text, setText] = useState("");
  const [type, setType] = useState("");
  const numbers = parseRoomNumbers(text);
  const dup = numbers.filter((n) => existing.includes(n));
  const ok = numbers.length > 0 && dup.length === 0;
  return (
    <Modal
      title="객실 등록"
      desc="같은 객실 타입끼리 나눠서 등록하면 편해요. 층은 호수에서 자동으로 정해져요."
      onClose={onClose}
      footer={
        <>
          <PmButton variant="ghost" onClick={onClose}>
            취소
          </PmButton>
          <PmButton
            variant="primary"
            disabled={pending || !ok}
            onClick={() =>
              onSubmit(numbers.map((n) => ({ number: n, floor: floorOf(n), roomType: type.trim() || undefined })))
            }
          >
            {pending ? "저장 중…" : numbers.length ? `${numbers.length}개 등록` : "등록"}
          </PmButton>
        </>
      }
    >
      <Field label="호수" hint="범위는 201-207, 여러 개는 쉼표나 줄바꿈으로 — 예: 201-207, 301-307, 별관-1">
        <textarea
          className="pm-input"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="201-207, 301-307"
        />
      </Field>
      <Field label="객실 타입 (선택)">
        <input
          className="pm-input"
          maxLength={40}
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="예: 스탠다드 더블"
        />
      </Field>
      {numbers.length > 0 && (
        <div className="op-dlg__preview">
          <p>
            <strong className="num">{numbers.length}</strong>개 객실
          </p>
          <ul>
            {numbers.slice(0, 60).map((n) => (
              <li key={n} className={cx("num", dup.includes(n) && "is-dup")}>
                {n}
              </li>
            ))}
            {numbers.length > 60 && <li>…</li>}
          </ul>
          {dup.length > 0 && <p className="pm-error">이미 등록된 호수가 있어요: {dup.join(", ")}</p>}
        </div>
      )}
    </Modal>
  );
}

function NoticeDialog({
  pending,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  onClose: () => void;
  onSubmit: (body: string, pinned: boolean) => void;
}) {
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  return (
    <Modal
      title="공지 쓰기"
      desc="모든 직원에게 보여요. 누가 확인했는지 공지 아래에 표시돼요."
      onClose={onClose}
      footer={
        <>
          <PmButton variant="ghost" onClick={onClose}>
            취소
          </PmButton>
          <PmButton variant="primary" disabled={pending || !body.trim()} onClick={() => onSubmit(body.trim(), pinned)}>
            {pending ? "올리는 중…" : "공지 올리기"}
          </PmButton>
        </>
      }
    >
      <Field label="내용">
        <textarea
          className="pm-input"
          rows={5}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="예: 목요일 오전 10시~12시 전 객실 소독 방역"
        />
      </Field>
      <label className="op-check">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />맨 위에 고정
      </label>
    </Modal>
  );
}
