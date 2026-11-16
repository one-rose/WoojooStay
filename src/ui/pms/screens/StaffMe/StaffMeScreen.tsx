"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClockAction, OpsActions, OpsData, ShiftKind, StaffMeData } from "@/core";
import { cx, formatNumber } from "@/shared";
import { Logo } from "@/ui/brand";
import { Icon, DemoBar } from "../../components";
import { StaffOpsPanel } from "./StaffOpsPanel";
import "./staff-me.css";

const SHIFT: Record<ShiftKind, string> = { day: "주간", night: "야간", off: "휴무" };
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
}: {
  data: StaffMeData | null;
  clock?: ClockAction;
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
      <Body data={data} clock={clock} logoutPath={logoutPath} ops={ops} opsActions={opsActions} />
    </>
  );
}

function Body({
  data,
  clock,
  logoutPath,
  ops,
  opsActions,
}: {
  data: StaffMeData;
  clock?: ClockAction;
  logoutPath?: string;
  ops?: OpsData | null;
  opsActions?: Pick<OpsActions, "setRoomStatus" | "readNote" | "addNote">;
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

  const press = () => {
    if (state === "done") return;
    const action = state === "ready" ? "in" : "out";
    start(async () => {
      setError(null);
      if (clock) {
        const r = await clock(data.employee.id, action);
        if (!r.ok) return setError(r.message);
      }
      setState(action === "in" ? "working" : "done");
      router.refresh();
    });
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
          <b>{SHIFT[data.today.shift]}</b>
        </p>
        <p className="sm-clock__time num">{time ?? "--:--"}</p>
        {offDay && <p className="sm-clock__offnote">오늘은 휴무예요. 대신 근무하게 됐다면 눌러 주세요.</p>}
        <button type="button" className="sm-clock__btn" disabled={pending || state === "done"} onClick={press}>
          {pending ? "기록 중…" : label}
        </button>
        <p className="sm-clock__log num">{log}</p>
        {error && (
          <p className="sm-clock__error" role="alert">
            {error}
          </p>
        )}
      </section>

      {ops && <StaffOpsPanel data={ops} actions={opsActions} shift={data.today.shift} />}

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
      </section>

      <section className="sm-card sm-month">
        <div>
          <span>이번 달 근무</span>
          <b className="num">{data.month.hours}시간</b>
          {data.month.nightHours > 0 && <small>야간 {data.month.nightHours}시간 포함</small>}
        </div>
        <div>
          <span>예상 급여</span>
          <b className="num">{formatNumber(data.month.estimatedPay)}원</b>
          <small>세금 떼기 전, 확정 전 금액</small>
        </div>
      </section>

      <section className="sm-card">
        <h2>이번 달 기록</h2>
        {data.records.length === 0 ? (
          <p className="sm-empty">아직 기록이 없어요.</p>
        ) : (
          <ul className="sm-records">
            {data.records.map((r) => (
              <li key={r.date}>
                <span className="num">{md(r.date)}</span>
                <span className="num">
                  {r.in} – {r.out ?? "퇴근 기록 없음"}
                </span>
                <b className="num">{r.hours != null ? `${r.hours}h` : ""}</b>
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
    </main>
  );
}
