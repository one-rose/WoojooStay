"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SHIFT_TIME,
  type ClockAction,
  type OpsActions,
  type OpsData,
  type ShiftKind,
  type StaffMeData,
  type UndoClockOutAction,
} from "@/core";
import { cx, formatHours, formatNumber, weekdayKo } from "@/shared";
import { Logo } from "@/ui/brand";
import { Icon, DemoBar } from "../../components";
import { StaffOpsPanel } from "./StaffOpsPanel";
import "./staff-me.css";

const SHIFT: Record<ShiftKind, string> = { day: "낮", night: "밤", off: "휴무", unset: "미정" };
/** "낮 09–16시" · "휴무" */
const shiftText = (k: ShiftKind) => (k === "day" || k === "night" ? `${SHIFT[k]} ${SHIFT_TIME[k].hours}` : SHIFT[k]);
type MeTab = "today" | "mine";
const DOW = ["월", "화", "수", "목", "금", "토", "일"];
const ROLE = { front: "프런트", housekeeping: "하우스키핑", night: "야간", manager: "매니저" } as const;
const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8))}`;

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0); // 서버 렌더와 시각이 달라 첫 표시는 브라우저에서
    const t = setInterval(tick, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  return now?.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

/** 직원 본인 출퇴근 (F5-02) — 휴대폰에서 쓰는 한 장짜리 화면. clock 이 없으면 예시 */
export function StaffMeScreen({
  data,
  clock,
  logoutPath,
  message,
  ops,
  opsActions,
  undoOut,
}: {
  data: StaffMeData | null;
  clock?: ClockAction;
  /** 방금 누른 퇴근 되돌리기 (퇴근 후 5분 안) — 없으면 체험 모드에서만 화면으로 되돌린다 */
  undoOut?: UndoClockOutAction;
  logoutPath?: string;
  /** 현장 업무 — 객실·공지·인수인계 (F7). 없으면 숨김 */
  ops?: OpsData | null;
  opsActions?: Pick<OpsActions, "setRoomStatus" | "readNote" | "addNote">;
  /** data 가 없을 때 안내 (직원 명단에 없음 등) */
  message?: string;
}) {
  if (!data)
    return (
      <main className="sm-missing">
        <Logo className="sm-top__logo" />
        <p>{message}</p>
        {logoutPath && (
          <form action={logoutPath} method="post">
            <button type="submit">로그아웃</button>
          </form>
        )}
      </main>
    );
  return (
    <>
      {!clock && <DemoBar current="/app/me" />}
      <Body data={data} clock={clock} logoutPath={logoutPath} ops={ops} opsActions={opsActions} undoOut={undoOut} />
    </>
  );
}

function Body({
  data,
  clock,
  logoutPath,
  ops,
  opsActions,
  undoOut,
}: {
  data: StaffMeData;
  clock?: ClockAction;
  logoutPath?: string;
  ops?: OpsData | null;
  opsActions?: Pick<OpsActions, "setRoomStatus" | "readNote" | "addNote">;
  undoOut?: UndoClockOutAction;
}) {
  const router = useRouter();
  const time = useClock();
  // 서버에서 새 값이 오면(router.refresh) 그것으로 맞춘다
  const [base, setBase] = useState(data.state);
  const [state, setState] = useState(data.state);
  if (base !== data.state) {
    setBase(data.state);
    setState(data.state);
  }
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<MeTab>("today");
  /** 퇴근 전 확인 — 인수인계 남기고 퇴근할지 */
  const [leaving, setLeaving] = useState(false);
  const [handover, setHandover] = useState("");
  const [left, setLeft] = useState<string | null>(null);
  /** 퇴근 직후 5초 동안 [되돌리기] (서버는 퇴근 후 5분까지 받아 준다) */
  const [undoable, setUndoable] = useState(false);
  useEffect(() => {
    if (!undoable) return;
    const t = setTimeout(() => setUndoable(false), 5_000);
    return () => clearTimeout(t);
  }, [undoable]);
  const undo = () =>
    start(async () => {
      setError(null);
      if (clock) {
        if (!undoOut) return setError("지금은 되돌릴 수 없어요. 사장님이나 매니저에게 말해 주세요.");
        const r = await undoOut();
        if (!r.ok) {
          setUndoable(false);
          return setError(r.message);
        }
      }
      setUndoable(false);
      setLeft("퇴근을 되돌렸어요. 계속 근무 중이에요.");
      setState("working");
      router.refresh();
    });

  const clockIt = (action: "in" | "out", note?: string) =>
    start(async () => {
      setError(null);
      if (note && opsActions) {
        const n = await opsActions.addNote({
          kind: "handover",
          body: note,
          shift: data.today.shift === "night" ? "night" : "day",
        });
        if (!n.ok) return setError(n.message);
      }
      if (clock) {
        const r = await clock(data.employee.id, action);
        if (!r.ok) return setError(r.message);
      }
      setLeaving(false);
      setHandover("");
      if (action === "out") {
        setLeft(note ? "인수인계를 남기고 퇴근했어요. 수고하셨어요." : "퇴근했어요. 수고하셨어요.");
        setUndoable(true);
      }
      setState(action === "in" ? "working" : "done");
      router.refresh();
    });

  const press = () => {
    if (state === "done") return;
    if (state === "working") return setLeaving(true);
    clockIt("in");
  };

  const offDay = data.today.shift === "off" && state === "ready";
  const label =
    state === "ready" ? (offDay ? "그래도 출근하기" : "출근하기") : state === "working" ? "퇴근하기" : "오늘 근무 끝";
  const log = data.today.in
    ? `출근 ${data.today.in}   퇴근 ${data.today.out ?? "아직"}`
    : state === "ready"
      ? "아직 출근 기록이 없어요"
      : "방금 기록했어요";
  return (
    <main className="sm">
      <header className="sm-top">
        <Logo className="sm-top__logo" />
        {logoutPath && (
          <form action={logoutPath} method="post">
            <button type="submit" className="sm-top__out">
              로그아웃
            </button>
          </form>
        )}
      </header>

      <section className="sm-hello">
        <p className="sm-hello__place">{data.property}</p>
        <h1>
          {data.employee.name}님 <small>{ROLE[data.employee.role]}</small>
        </h1>
      </section>

      <section className={cx("sm-clock", `is-${state}`, offDay && "is-offday")} aria-label="출퇴근">
        <p className="sm-clock__date">
          {md(data.date)} ({DOW[(new Date(`${data.date}T00:00:00Z`).getUTCDay() + 6) % 7]}) 오늘{" "}
          <b>{shiftText(data.today.shift)}</b>
        </p>
        <p className="sm-clock__time num">{time ?? "--:--"}</p>
        {offDay && <p className="sm-clock__offnote">오늘은 휴무예요. 대신 근무하게 됐다면 눌러 주세요.</p>}
        <button type="button" className="sm-clock__btn" disabled={pending || state === "done"} onClick={press}>
          {pending ? "기록 중…" : label}
        </button>
        <p className="sm-clock__log num">{log}</p>
        {left && (
          <p className="sm-clock__left" role="status">
            {left}
            {undoable && state === "done" && (
              <>
                {" "}
                <button type="button" className="sm-clock__undo" disabled={pending} onClick={undo}>
                  되돌리기
                </button>
              </>
            )}
          </p>
        )}
        {error && (
          <p className="sm-clock__error" role="alert">
            {error}
          </p>
        )}
      </section>

      {leaving && (
        <section className="sm-leave" role="dialog" aria-modal="false" aria-labelledby="sm-leave-title">
          <h2 id="sm-leave-title">인수인계 남기고 퇴근할까요?</h2>
          <p>다음 근무자가 알아야 할 일이 있으면 적어 주세요. 없으면 그냥 퇴근해도 돼요.</p>
          {opsActions || !clock ? (
            <textarea
              className="sm-ops-text"
              rows={3}
              maxLength={2000}
              aria-label="인수인계 내용"
              placeholder="예: 305호 리모컨 건전지 교체 필요"
              value={handover}
              onChange={(e) => setHandover(e.target.value)}
            />
          ) : null}
          <div className="sm-leave__actions">
            <button type="button" className="sm-ops-btn" disabled={pending} onClick={() => clockIt("out")}>
              그냥 퇴근
            </button>
            <button
              type="button"
              className="sm-ops-btn is-solid"
              disabled={pending || !handover.trim()}
              onClick={() => clockIt("out", handover.trim())}
            >
              {pending ? "기록 중…" : "남기고 퇴근"}
            </button>
          </div>
          <button type="button" className="sm-leave__cancel" onClick={() => setLeaving(false)} disabled={pending}>
            아직 일하는 중이에요
          </button>
        </section>
      )}

      <div className="sm-tabs" role="tablist" aria-label="보기">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "today"}
          className={cx(tab === "today" && "is-on")}
          onClick={() => setTab("today")}
        >
          오늘 일
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "mine"}
          className={cx(tab === "mine" && "is-on")}
          onClick={() => setTab("mine")}
        >
          내 근무와 급여
        </button>
      </div>

      {tab === "today" &&
        (ops ? (
          <StaffOpsPanel data={ops} actions={opsActions} shift={data.today.shift} />
        ) : (
          <section className="sm-card">
            <p className="sm-empty">현장 업무를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</p>
          </section>
        ))}

      {tab === "mine" && (
        <>
          <section className="sm-card">
            <h2>이번 주 근무</h2>
            <ol className="sm-week">
              {data.week.dates.map((d, i) => (
                <li key={d} className={cx(`is-${data.week.shifts[i]}`, d === data.date && "is-today")}>
                  <span>{DOW[i]}</span>
                  <b className="num">{Number(d.slice(8))}</b>
                  <em>{SHIFT[data.week.shifts[i]]}</em>
                </li>
              ))}
            </ol>
            <p className="sm-week__note">
              낮 근무는 {SHIFT_TIME.day.hours}, 밤 근무는 {SHIFT_TIME.night.hours}예요.
            </p>
          </section>

          {data.coworkers && (
            <section className="sm-card">
              <h2>오늘 같이 일하는 사람</h2>
              {data.coworkers.length === 0 ? (
                <p className="sm-empty">오늘 근무표에 다른 사람이 없어요.</p>
              ) : (
                <ul className="sm-records sm-crew">
                  {data.coworkers.map((c) => (
                    <li key={c.name}>
                      <span>{c.name}</span>
                      <span className="num">{c.shift ? shiftText(c.shift) : "근무표 없이 출근"}</span>
                      <b>{c.working ? "근무 중" : ""}</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {data.nextWeek && (
            <section className="sm-card">
              <h2>다음 주 근무</h2>
              <ol className="sm-week">
                {data.nextWeek.dates.map((d, i) => (
                  <li key={d} className={cx(`is-${data.nextWeek!.shifts[i]}`)}>
                    <span>{DOW[i]}</span>
                    <b className="num">{Number(d.slice(8))}</b>
                    <em>{SHIFT[data.nextWeek!.shifts[i]]}</em>
                  </li>
                ))}
              </ol>
              {data.nextWeek.shifts.every((k) => k === "unset") && (
                <p className="sm-week__note">다음 주 근무표가 아직 없어요. 정해지면 여기에 보여요.</p>
              )}
            </section>
          )}

          <section className="sm-card">
            <div className="sm-month">
              <div>
                <span>이번 달 근무</span>
                <b className="num">{formatHours(data.month.hours)}</b>
                {data.month.nightHours > 0 && <small>밤 근무 {formatHours(data.month.nightHours)} 포함</small>}
              </div>
              <div>
                <span>예상 급여</span>
                <b className="num">{formatNumber(data.month.estimatedPay)}원</b>
                <small>세금 떼기 전, 확정 전 금액</small>
              </div>
            </div>
            <details className="sm-pay">
              <summary>예상 급여는 이렇게 계산했어요</summary>
              {data.pay ? (
                <PayRows pay={data.pay} />
              ) : (
                <ul>
                  <li>
                    <span>일한 시간</span>
                    <b className="num">{formatHours(data.month.hours)}</b>
                  </li>
                  <li>
                    <span>그중 밤 10시~아침 6시</span>
                    <b className="num">{formatHours(data.month.nightHours)}</b>
                  </li>
                </ul>
              )}
              <p>
                시급 × 일한 시간에 밤 10시~아침 6시 근무는 시급의 50%를 더하고, 한 주에 15시간 넘게 일한 주는
                주휴수당(8시간분)을 더했어요. 세금을 떼기 전 금액이고, 사장님이 확정하면 바뀔 수 있어요.
              </p>
            </details>
          </section>

          <section className="sm-card">
            <h2>이번 달 기록</h2>
            {data.records.length === 0 ? (
              <p className="sm-empty">아직 기록이 없어요.</p>
            ) : (
              <ul className="sm-records">
                {data.records.map((r) => (
                  <li key={r.date}>
                    <span className="num">
                      {Number(r.date.slice(8))}일 ({weekdayKo(r.date)})
                    </span>
                    <span className="num">
                      {r.in} – {r.out ?? "퇴근 기록 없음"}
                    </span>
                    <b className="num">{r.hours != null ? formatHours(r.hours) : ""}</b>
                    {r.edited && (
                      <em title="사장님이 고친 기록">
                        <Icon name="edit" size={12} /> 수정됨
                      </em>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="sm-note">기록이 틀렸다면 사장님이나 매니저에게 말해 주세요. 고친 내역은 남아요.</p>
          </section>
        </>
      )}
    </main>
  );
}

/** 예상 급여 내역 — 사장님 급여 화면과 같은 숫자 */
function PayRows({ pay }: { pay: NonNullable<StaffMeData["pay"]> }) {
  const won = (n: number) => `${formatNumber(n)}원`;
  if (pay.type === "monthly")
    return (
      <ul>
        <li>
          <span>월급 {pay.monthly ? won(pay.monthly) : ""}</span>
          <b className="num">{won(pay.base)}</b>
        </li>
        <li>
          <span>합계</span>
          <b className="num">{won(pay.total)}</b>
        </li>
      </ul>
    );
  return (
    <ul>
      <li>
        <span>시급</span>
        <b className="num">{won(pay.rate ?? 0)}</b>
      </li>
      <li>
        <span>
          기본 {formatHours(pay.hours)} × {won(pay.rate ?? 0)}
        </span>
        <b className="num">{won(pay.base)}</b>
      </li>
      <li>
        <span>밤 근무 가산 {formatHours(pay.nightHours)} × 50%</span>
        <b className="num">+{won(pay.night)}</b>
      </li>
      <li>
        <span>주휴수당{pay.weeklyHours ? ` ${formatHours(pay.weeklyHours)}` : ""}</span>
        <b className="num">+{won(pay.weekly)}</b>
      </li>
      <li>
        <span>합계</span>
        <b className="num">{won(pay.total)}</b>
      </li>
    </ul>
  );
}
