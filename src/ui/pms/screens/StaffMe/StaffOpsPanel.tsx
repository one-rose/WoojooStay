"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROOM_NEXT, type OpsActions, type OpsData, type RoomStatus, type RoomUnit } from "@/core";
import { cx, josa } from "@/shared";
import { DONE_LABEL, NEXT_LABEL, ROOM_LABEL, SHIFT_LABEL, dayLabel, hm } from "../Ops/ops-format";

const TODO = ["dirty", "cleaning", "inspect"] as const;
/** 손이 가야 하는 객실은 처음에 이만큼만 (나머지는 더 보기) */
const ROOM_LIMIT = 5;

/**
 * 직원 휴대폰 화면의 현장 업무 — 안 읽은 공지·인수인계, 손이 가야 하는 객실, 인수인계 남기기 (F7)
 * actions 가 없으면 예시
 */
export function StaffOpsPanel({
  data,
  actions,
  shift,
}: {
  data: OpsData;
  actions?: Pick<OpsActions, "setRoomStatus" | "readNote" | "addNote">;
  shift: "day" | "night" | "off" | "unset";
}) {
  const router = useRouter();
  // 서버에서 새 목록이 오면(router.refresh) 화면에서 바꿔 둔 값을 버리고 다시 맞춘다
  const [base, setBase] = useState(data.rooms);
  const [rooms, setRooms] = useState(data.rooms);
  if (base !== data.rooms) {
    setBase(data.rooms);
    setRooms(data.rooms);
  }
  const [read, setRead] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  /** 방금 바꾼 객실 — 몇 초 동안 되돌리기 */
  const [undo, setUndo] = useState<{ room: RoomUnit; prev: RoomStatus; text: string } | null>(null);
  const [allRooms, setAllRooms] = useState(false);
  /** 이 화면에서 방금 남긴 인수인계 */
  const [sent, setSent] = useState<{ body: string; at: string }[]>([]);
  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => setUndo(null), 6000);
    return () => window.clearTimeout(t);
  }, [undo]);

  const run = (
    fn: () => Promise<{ ok: boolean; message?: string; status?: number }>,
    done: string,
    after: () => void,
  ) =>
    start(async () => {
      if (actions) {
        const r = await fn();
        if (!r.ok) {
          setMsg({ bad: true, text: r.message ?? "저장하지 못했어요." });
          // 다른 사람이 먼저 바꿨으면 최신 상태로
          if (r.status === 409) router.refresh();
          return;
        }
      }
      after();
      setMsg({ bad: false, text: actions ? done : "체험 모드라 저장되지 않아요. 실제 서비스에서는 바로 반영돼요." });
      if (actions) router.refresh();
    });

  const unread = [...data.notices, ...data.handovers].filter((n) => !n.readByMe && !read.includes(n.id));
  const todo = rooms
    .filter((r) => (TODO as readonly string[]).includes(r.status))
    .sort((a, b) => TODO.indexOf(a.status as never) - TODO.indexOf(b.status as never));
  const occupied = rooms.filter((r) => r.status === "occupied").sort((a, b) => a.number.localeCompare(b.number));

  const advance = (r: RoomUnit) => {
    const next = ROOM_NEXT[r.status];
    if (!next) return;
    const prevStatus = r.status;
    start(async () => {
      setMsg(null);
      if (actions) {
        const res = await actions.setRoomStatus(r.id, next, r.memo ?? undefined);
        if (!res.ok) {
          setMsg({ bad: true, text: res.message ?? "저장하지 못했어요." });
          if (res.status === 409) router.refresh();
          return;
        }
      }
      setRooms((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: next } : x)));
      // 객실이 다른 묶음으로 옮겨 가도 무엇을 했는지 보이게 — 되돌리기 함께
      setUndo({
        room: { ...r, status: next },
        prev: prevStatus,
        text: `${r.number}호 ${DONE_LABEL[next] ?? ROOM_LABEL[next].label}`,
      });
      if (actions) router.refresh();
    });
  };

  const revert = () => {
    if (!undo) return;
    const { room, prev } = undo;
    setUndo(null);
    start(async () => {
      if (actions) {
        const res = await actions.setRoomStatus(room.id, prev, room.memo ?? undefined);
        if (!res.ok) {
          setMsg({ bad: true, text: res.message ?? "되돌리지 못했어요." });
          if (res.status === 409) router.refresh();
          return;
        }
      }
      setRooms((list) => list.map((x) => (x.id === room.id ? { ...x, status: prev } : x)));
      setMsg({ bad: false, text: `${room.number}호를 ${josa(ROOM_LABEL[prev].label, "으로/로")} 되돌렸어요.` });
      if (actions) router.refresh();
    });
  };

  const myHandovers = [
    // 서버 목록에 이미 들어온 글은 한 번만
    ...sent
      .filter((x) => !data.handovers.some((n) => n.isMine && n.body === x.body))
      .map((x, i) => ({ id: `sent-${i}`, body: x.body, createdAt: x.at })),
    ...data.handovers.filter((n) => n.isMine).map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt })),
  ].slice(0, 3);

  return (
    <>
      {msg && (
        <p className={cx("sm-ops-msg", msg.bad && "is-bad")} role={msg.bad ? "alert" : "status"}>
          {msg.text}
        </p>
      )}

      {unread.length > 0 && (
        <section className="sm-card">
          <h2>
            확인할 글 <span className="sm-ops-count num">{unread.length}</span>
          </h2>
          <ul className="sm-notes">
            {unread.map((n) => (
              <li key={n.id}>
                <p className="sm-notes__head">
                  <b>{n.kind === "notice" ? "공지" : n.shift ? `${SHIFT_LABEL[n.shift]} 인수인계` : "인수인계"}</b>
                  <span>{n.author}</span>
                  <span className="num">
                    {dayLabel(n.createdAt, data.date)} {hm(n.createdAt)}
                  </span>
                </p>
                <p className="sm-notes__body">{n.body}</p>
                <button
                  type="button"
                  className="sm-ops-btn"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => actions!.readNote(n.id),
                      "확인 표시를 남겼어요.",
                      () => setRead((x) => [...x, n.id]),
                    )
                  }
                >
                  확인했어요
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rooms.length > 0 && (
        <section className="sm-card">
          <h2>
            손이 가야 하는 객실 <span className="sm-ops-count num">{todo.length}</span>
          </h2>
          {todo.length === 0 ? (
            <p className="sm-empty">지금은 청소나 점검할 객실이 없어요.</p>
          ) : (
            <>
              {/* 다음 객실 — 지금 할 일 하나를 크게, 버튼 하나 48px (S4) */}
              <div className={cx("sm-next", `is-${todo[0].status}`)}>
                <p className="sm-next__label">다음 객실</p>
                <p className="sm-next__room">
                  <b className="num">{todo[0].number}</b>
                  <span>{ROOM_LABEL[todo[0].status].label}</span>
                </p>
                {todo[0].memo && <p className="sm-next__memo">{todo[0].memo}</p>}
                <button type="button" className="sm-next__btn" disabled={pending} onClick={() => advance(todo[0])}>
                  {NEXT_LABEL[todo[0].status]}
                </button>
              </div>
              {todo.length > 1 && (
                <ul className="sm-rooms">
                  {(allRooms ? todo.slice(1) : todo.slice(1, ROOM_LIMIT)).map((r) => (
                    <li key={r.id} className={`is-${r.status}`}>
                      <b className="num">{r.number}</b>
                      <span>
                        {ROOM_LABEL[r.status].label}
                        {r.memo && <small>{r.memo}</small>}
                      </span>
                      <button type="button" className="sm-ops-btn" disabled={pending} onClick={() => advance(r)}>
                        {NEXT_LABEL[r.status]}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {todo.length > ROOM_LIMIT && (
            <button type="button" className="sm-more" onClick={() => setAllRooms((v) => !v)}>
              {allRooms ? "급한 객실만 보기" : `${todo.length - ROOM_LIMIT}개 더 보기`}
            </button>
          )}
        </section>
      )}

      {occupied.length > 0 && (
        <section className="sm-card">
          <details className="sm-out">
            <summary>
              <span>
                투숙 중 → 퇴실 처리 <span className="sm-ops-count num">{occupied.length}</span>
              </span>
            </summary>
            <ul className="sm-rooms">
              {occupied.map((r) => (
                <li key={r.id} className="is-occupied">
                  <b className="num">{r.number}</b>
                  <span>
                    {ROOM_LABEL[r.status].label}
                    {r.memo && <small>{r.memo}</small>}
                  </span>
                  <button type="button" className="sm-ops-btn" disabled={pending} onClick={() => advance(r)}>
                    {NEXT_LABEL[r.status]}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      <section className="sm-card">
        <h2>인수인계 남기기</h2>
        <textarea
          className="sm-ops-text"
          rows={3}
          maxLength={2000}
          aria-label="인수인계 내용"
          placeholder="다음 근무자에게 넘길 일"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="button"
          className="sm-ops-btn is-solid"
          disabled={pending || !text.trim()}
          onClick={() =>
            run(
              () =>
                actions!.addNote({ kind: "handover", body: text.trim(), shift: shift === "night" ? "night" : "day" }),
              "다음 근무자에게 남겼어요. 다음 근무자가 확인하면 확인 표시가 붙어요.",
              () => {
                setSent((x) => [{ body: text.trim(), at: new Date().toISOString() }, ...x]);
                setText("");
              },
            )
          }
        >
          남기기
        </button>
        {myHandovers.length > 0 && (
          <div className="sm-mine">
            <h3>내가 남긴 글</h3>
            <ul>
              {myHandovers.map((n) => (
                <li key={n.id}>
                  <span className="num">
                    {dayLabel(n.createdAt, data.date)} {hm(n.createdAt)}
                  </span>
                  <p>{n.body}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {undo && (
        <div className="sm-toast" role="status">
          <span>{undo.text}</span>
          <button type="button" onClick={revert} disabled={pending}>
            되돌리기
          </button>
        </div>
      )}
    </>
  );
}
