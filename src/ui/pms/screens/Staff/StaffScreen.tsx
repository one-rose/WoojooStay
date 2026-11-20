"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  ActionResult,
  AttendanceRow,
  ContractStatus,
  MissingClockOut,
  PayrollRow,
  ShiftKind,
  StaffActions,
  StaffData,
  StaffMember,
  StaffMonthAttendance,
  StaffRole,
} from "@/core";
import { SHIFT_TIME } from "@/core";
import { addDays, cx, formatHours, formatNumber, formatWon, weekdayKo } from "@/shared";
import {
  Badge,
  Card,
  Field,
  Icon,
  Modal,
  PageHead,
  PmButton,
  Stat,
  StatRow,
  TableWrap,
  Tabs,
  type BadgeTone,
} from "../../components";
import "./staff.css";

type Tab = "members" | "attendance" | "schedule" | "payroll";

const TABS = [
  { id: "members", label: "직원·계약" },
  { id: "attendance", label: "근태" },
  { id: "schedule", label: "교대 스케줄" },
  { id: "payroll", label: "급여" },
] as const;

const ROLE: Record<StaffRole, string> = {
  manager: "매니저",
  front: "프런트",
  night: "야간",
  housekeeping: "하우스키핑",
};
const CONTRACT: Record<ContractStatus, { tone: BadgeTone; label: string }> = {
  signed: { tone: "ok", label: "서명 완료" },
  sent: { tone: "info", label: "서명 대기" },
  none: { tone: "bad", label: "미작성" },
};
const ATTEND: Record<AttendanceRow["status"], { tone: BadgeTone; label: string }> = {
  working: { tone: "ok", label: "근무 중" },
  done: { tone: "neutral", label: "퇴근" },
  "missing-out": { tone: "warn", label: "퇴근 누락" },
  late: { tone: "warn", label: "지각" },
  scheduled: { tone: "neutral", label: "출근 전" },
  off: { tone: "neutral", label: "휴무" },
};
const SHIFT: Record<ShiftKind, string> = { day: "낮", night: "밤", off: "휴무", unset: "미정" };
const won = formatWon;

type Dialog =
  | { kind: "add" }
  /** 기록 수정 — missing: 퇴근 누락 목록에서 (그 근무일·출근 시각을 채워서) */
  | {
      kind: "edit";
      staffId: string;
      missing?: MissingClockOut;
      /** 이번 달 기록에서 고른 날 — 저장하면 이번 달 기록으로 돌아간다 */
      day?: { date: string; in?: string; out?: string; month: string };
    }
  /** 직원 한 명의 이번 달 기록 (날짜별 출퇴근, 줄마다 고치기) */
  | { kind: "month"; staffId: string; month?: string }
  | { kind: "member"; staffId: string; focusPay?: boolean }
  | null;

/** 화면 안내 — fix: 고칠 곳으로 가는 버튼 */
type Note = { bad: boolean; text: string; fix?: { label: string; tab: Tab } };

const monthLabel = (m: string) => `${m.slice(0, 4)}년 ${Number(m.slice(5))}월`;

interface StaffScreenProps {
  data: StaffData;
  actions?: StaffActions;
  /** 급여 탭에 보일 달 (기본: 지난달) — 없으면 data 의 이번 달 */
  payroll?: { month: string; rows: readonly PayrollRow[]; members: readonly StaffMember[] };
  /** 고를 수 있는 급여 달 (최근 순) */
  payMonths?: readonly string[];
  /** 지금 업장에서 내 역할 — 매니저는 급여 탭·급여 금액·급여 확정·계약서 발송을 보지 않는다 */
  role?: "owner" | "manager";
  /** 근태에서 고른 지난 날짜(?day=)의 출퇴근 — 없으면 오늘 */
  attendance?: { date: string; rows: readonly AttendanceRow[] };
  /** 근태 '이번 달 기록' 불러오기 — 체험 모드도 예시로 */
  loadMonth?: (staffId: string, month: string) => Promise<ActionResult<StaffMonthAttendance>>;
}

/** 알바관리 (F5-01 ~ F5-04 · F5-06). actions 가 없으면 예시 화면 */
export function StaffScreen({
  data,
  actions,
  payroll,
  payMonths,
  role = "owner",
  attendance,
  loadMonth,
}: StaffScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const owner = role === "owner";
  const tabs = owner ? TABS : TABS.filter((t) => t.id !== "payroll");
  const [tab, setTab] = useState<Tab>(() =>
    owner && search.get("payMonth")
      ? "payroll"
      : search.get("week")
        ? "schedule"
        : search.get("day") || search.get("tab") === "attendance"
          ? "attendance"
          : "members",
  );
  // 근태 — 고른 날의 출퇴근 (지난 날짜도 고칠 수 있게)
  const attendDay = attendance?.date ?? data.date;
  const attendRows = attendance?.rows ?? data.today;
  const dayHref = (d: string | null) => {
    const q = new URLSearchParams(search.toString());
    if (d && d !== data.date) q.set("day", d);
    else q.delete("day");
    q.delete("tab");
    const qs = q.toString();
    return qs ? `${pathname}?${qs}` : `${pathname}?tab=attendance`;
  };
  // 교대표: 서버 값 위에 고친 칸만 덮어쓴다 — 새로고침으로 서버 값이 바뀌면 덮어쓴 값은 버린다
  const [shiftBase, setShiftBase] = useState(data.week.shifts);
  const [edits, setEdits] = useState<Record<string, ShiftKind>>({});
  const [savingCell, setSavingCell] = useState<string | null>(null);
  if (shiftBase !== data.week.shifts) {
    setShiftBase(data.week.shifts);
    setEdits({});
  }
  // 근무표가 없는 날은 미정 (휴무와 다르게)
  const shiftOf = (id: string, i: number): ShiftKind => edits[`${id}:${i}`] ?? data.week.shifts[id]?.[i] ?? "unset";
  const [dialog, setDialogRaw] = useState<Dialog>(null);
  const [note, setNote] = useState<Note | null>(null);
  // 대화 상자를 열 때는 지난 안내를 지운다 (상자 안에 오류를 보여 준다)
  const setDialog = (d: Dialog) => {
    if (d) setNote(null);
    setDialogRaw(d);
  };
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<unknown>>, done: string, after?: () => void) =>
    start(async () => {
      if (!actions)
        return setNote({ bad: false, text: "체험 모드라 저장되지 않아요. 실제 서비스에서는 바로 반영돼요." });
      const r = await fn();
      if (!r.ok) return setNote(failNote(r, owner));
      after?.();
      setNote({ bad: false, text: done });
      router.refresh();
    });
  const byId: Record<string, StaffMember> = Object.fromEntries(
    [...(payroll?.members ?? []), ...data.members].map((m) => [m.id, m]),
  );
  const active = data.members.filter((m) => !m.resigned);
  // 급여 금액은 사장님만 본다 — 매니저에게는 최저임금 안내도 띄우지 않는다
  const belowMin = owner ? active.filter((m) => m.pay.type === "hourly" && m.pay.amount < data.minimumWage) : [];
  const missing = data.missingClockOut ?? [];
  // 교대표 주 이동 (?week=) — 이번 주가 아니면 "이번 주로"
  const weekStart = data.week.dates[0];
  const thisWeek = data.week.dates.includes(data.date);
  const weekHref = (monday: string | null) => {
    const q = new URLSearchParams(search.toString());
    if (monday) q.set("week", monday);
    else q.delete("week");
    const qs = q.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const pay = payroll ?? { month: data.month, rows: data.payroll, members: data.members };
  // 그 달에 입사 전이었던 직원은 빼고 본다
  const payRows = pay.rows.filter((p) => byId[p.staffId] && byId[p.staffId].joined.slice(0, 7) <= pay.month);
  const payTotal = payRows.reduce((s, p) => s + p.total, 0);
  const sentCount = payRows.filter((p) => p.status === "sent").length;
  const allConfirmed = payRows.length > 0 && payRows.every((p) => p.status === "confirmed" || p.status === "sent");
  const allSent = payRows.length > 0 && sentCount === payRows.length;
  // 진행 중인 달·앞으로 올 달은 확정할 수 없다 (API 도 MONTH_NOT_ENDED · FUTURE_MONTH)
  const monthEnded = pay.month < data.date.slice(0, 7);

  /** 교대 칸 — 바로 바꿔 보이고, 저장에 실패하면 되돌린다. 저장 중에는 그 칸을 잠근다 */
  const cycle = async (id: string, i: number) => {
    // 미정 → 낮 → 밤 → 휴무 → 낮 … (미정으로는 되돌리지 않는다)
    const order: ("day" | "night" | "off")[] = ["day", "night", "off"];
    const key = `${id}:${i}`;
    const prev = shiftOf(id, i);
    const next = prev === "unset" ? "day" : order[(order.indexOf(prev) + 1) % order.length];
    setEdits((e) => ({ ...e, [key]: next }));
    if (!actions) return;
    setSavingCell(key);
    const r = await actions.setShift(id, data.week.dates[i], next);
    setSavingCell(null);
    if (!r.ok) {
      setEdits((e) => ({ ...e, [key]: prev }));
      setNote({ bad: true, text: r.message });
    }
  };

  const pickMonth = (m: string) => {
    const q = new URLSearchParams(search.toString());
    q.set("payMonth", m);
    router.push(`${pathname}?${q}`, { scroll: false });
  };

  return (
    <div className="st">
      <PageHead
        title="알바관리"
        desc="직원 근로계약부터 출퇴근, 교대표, 급여까지 한곳에서 관리해요."
        actions={
          <PmButton variant="primary" icon="staff" onClick={() => setDialog({ kind: "add" })}>
            직원 추가
          </PmButton>
        }
      />
      <Tabs items={tabs} value={tab} onChange={setTab} label="알바관리 보기" />
      {note && !dialog && (
        <div className={cx("st-note", note.bad && "is-bad")} role={note.bad ? "alert" : "status"}>
          <p>{note.text}</p>
          {note.fix && note.fix.tab !== tab && (
            <PmButton size="sm" variant="ghost" onClick={() => setTab(note.fix!.tab)}>
              {note.fix.label}
            </PmButton>
          )}
        </div>
      )}

      {tab === "members" && (
        <>
          {belowMin.length > 0 && (
            <div className="st-alert">
              <Icon name="alert" size={16} />
              <p>
                <strong>{belowMin.map((m) => m.name).join(", ")}</strong> 시급이 {data.date.slice(0, 4)}년 최저임금(
                {won(data.minimumWage)})보다 낮아요. 급여를 확정하기 전에 고쳐 주세요.
              </p>
              <span className="st-alert__actions">
                {belowMin.map((m) => (
                  <PmButton
                    key={m.id}
                    size="sm"
                    variant="alert"
                    onClick={() => setDialog({ kind: "member", staffId: m.id, focusPay: true })}
                  >
                    {belowMin.length > 1 ? `${m.name} 시급 고치기` : "시급 고치기"}
                  </PmButton>
                ))}
              </span>
            </div>
          )}
          <Card title="직원" meta={`재직 ${active.length}명`} flush>
            <TableWrap>
              <table className="pm-table pm-rtable">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>역할</th>
                    {owner && <th className="is-num">급여 기준</th>}
                    <th>입사일</th>
                    <th>연락처</th>
                    <th>근로계약서</th>
                    <th>
                      <span className="pm-sr">동작</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.length === 0 && (
                    <tr>
                      <td colSpan={owner ? 7 : 6} className="is-muted st-empty">
                        아직 등록한 직원이 없어요. 오른쪽 위 &lsquo;직원 추가&rsquo;로 시작해 보세요.
                      </td>
                    </tr>
                  )}
                  {data.members.map((m) => {
                    const c = CONTRACT[m.contract];
                    const low = owner && !m.resigned && m.pay.type === "hourly" && m.pay.amount < data.minimumWage;
                    return (
                      <tr key={m.id} className={cx(m.resigned && "is-resigned")}>
                        <td className="pm-rtable__main">
                          <strong>{m.name}</strong>
                          {m.resigned && (
                            <>
                              {" "}
                              <Badge tone="neutral">퇴사 {m.resigned.slice(5).replace("-", ".")}</Badge>
                            </>
                          )}
                        </td>
                        <td data-label="역할">{ROLE[m.role]}</td>
                        {owner && (
                          <td className={cx("is-num", low && "st-low")} data-label="급여 기준">
                            {m.pay.type === "hourly" ? `시급 ${won(m.pay.amount)}` : `월급 ${won(m.pay.amount)}`}
                            {low && <Icon name="alert" size={13} />}
                          </td>
                        )}
                        <td className="num pm-rtable__hide-m">{m.joined.replaceAll("-", ".")}</td>
                        <td className="is-muted num" data-label="연락처">
                          {m.phone}
                        </td>
                        <td className="pm-rtable__state">
                          <Badge tone={c.tone}>{c.label}</Badge>
                        </td>
                        <td className="is-num pm-rtable__act">
                          <span className="st-row-actions">
                            {m.resigned || !owner ? null : m.contract === "none" ? (
                              <PmButton
                                size="sm"
                                disabled={pending}
                                onClick={() =>
                                  run(() => actions!.sendContract(m.id), `${m.name}님께 근로계약서를 문자로 보냈어요.`)
                                }
                              >
                                계약서 보내기
                              </PmButton>
                            ) : m.contract === "sent" ? (
                              <PmButton
                                size="sm"
                                disabled={pending}
                                onClick={() =>
                                  run(() => actions!.sendContract(m.id), `${m.name}님께 근로계약서를 다시 보냈어요.`)
                                }
                              >
                                다시 보내기
                              </PmButton>
                            ) : null}
                            <PmButton
                              size="sm"
                              variant="quiet"
                              icon="edit"
                              aria-label={`${m.name} 정보 고치기`}
                              onClick={() => setDialog({ kind: "member", staffId: m.id })}
                            >
                              고치기
                            </PmButton>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
            <p className="st-foot">
              근로계약서는 표준 양식으로 만들어 문자로 보내고, 직원이 휴대폰에서 전자서명해요.
              {!owner && " 급여와 근로계약서 발송은 사장님만 할 수 있어요."}
            </p>
          </Card>
        </>
      )}

      {tab === "attendance" && (
        <>
          <StatRow cols={3}>
            <Stat
              label="지금 근무 중"
              // 출근해서 아직 퇴근 전인 사람만 (어젯밤부터 이어진 야간 포함) — 지각·퇴근 누락은 빼고 센다
              value={data.today.filter((a) => a.status === "working").length}
              suffix="명"
              foot={`오늘 ${data.date.slice(5).replace("-", ".")}`}
            />
            <Stat
              label="확인 필요"
              value={
                data.today.filter((a) => a.status === "late").length +
                (data.missingClockOut ? missing.length : data.today.filter((a) => a.status === "missing-out").length)
              }
              suffix="건"
              foot="지각, 퇴근 누락"
            />
            <Stat
              label="이번 달 총 근무"
              value={Object.values(data.monthHours).reduce((s, h) => s + h, 0)}
              suffix="시간"
              foot={`${Number(data.month.slice(5))}월 기준`}
            />
          </StatRow>
          <Card
            title={
              attendDay === data.date
                ? "오늘 출퇴근"
                : `${attendDay.slice(5).replace("-", ".")} (${weekdayKo(attendDay)}) 출퇴근`
            }
            meta={
              <span className="st-week">
                <Link className="st-week__nav" aria-label="전날" href={dayHref(addDays(attendDay, -1))} scroll={false}>
                  <Icon name="chevronLeft" size={16} />
                </Link>
                <input
                  className="pm-input st-day"
                  type="date"
                  aria-label="날짜 고르기"
                  max={data.date}
                  value={attendDay}
                  onChange={(e) => e.target.value && router.push(dayHref(e.target.value), { scroll: false })}
                />
                {attendDay < data.date && (
                  <Link
                    className="st-week__nav"
                    aria-label="다음 날"
                    href={dayHref(addDays(attendDay, 1))}
                    scroll={false}
                  >
                    <Icon name="chevron" size={16} />
                  </Link>
                )}
                {attendDay !== data.date && (
                  <Link className="st-week__today" href={dayHref(null)} scroll={false}>
                    오늘로
                  </Link>
                )}
              </span>
            }
            flush
          >
            <TableWrap>
              <table className="pm-table">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>역할</th>
                    <th>출근</th>
                    <th>퇴근</th>
                    <th>상태</th>
                    <th className="is-num">이번 달 근무</th>
                    <th>
                      <span className="pm-sr">동작</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attendRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="is-muted st-empty">
                        {attendDay === data.date ? "오늘 출퇴근 기록이 아직 없어요." : "이 날 출퇴근 기록이 없어요."}
                      </td>
                    </tr>
                  )}
                  {attendRows.map((a) => {
                    const m = byId[a.staffId];
                    if (!m) return null;
                    const s = ATTEND[a.status];
                    return (
                      <tr key={a.staffId}>
                        <td>
                          {loadMonth ? (
                            <button
                              type="button"
                              className="st-namelink"
                              aria-label={`${m.name} 이번 달 기록`}
                              onClick={() => setDialog({ kind: "month", staffId: a.staffId })}
                            >
                              <strong>{m.name}</strong>
                            </button>
                          ) : (
                            <strong>{m.name}</strong>
                          )}
                        </td>
                        <td>{ROLE[m.role]}</td>
                        <td className="num">{a.in ?? <span className="is-muted">-</span>}</td>
                        <td className="num">{a.out ?? <span className="is-muted">-</span>}</td>
                        <td>
                          <Badge tone={s.tone}>{s.label}</Badge>
                        </td>
                        <td className="is-num">{formatHours(data.monthHours[a.staffId] ?? 0)}</td>
                        <td className="is-num">
                          {/* 정상 기록도 고칠 수 있게 — 문제 있는 줄만 진하게 */}
                          <PmButton
                            size="sm"
                            variant={a.status === "missing-out" || a.status === "late" ? "ghost" : "quiet"}
                            icon="edit"
                            onClick={() => setDialog({ kind: "edit", staffId: a.staffId })}
                          >
                            고치기
                          </PmButton>
                          {loadMonth && (
                            <PmButton
                              size="sm"
                              variant="quiet"
                              onClick={() => setDialog({ kind: "month", staffId: a.staffId })}
                            >
                              이번 달 기록
                            </PmButton>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
            <p className="st-foot">
              기록을 고치면 고친 사람, 시각, 사유가 남아요. 지난 날짜는 위에서 날짜를 고르거나 이름을 눌러 이번 달
              기록에서 고쳐요. 퇴근 누락은 다음 날 직원에게 확인 요청을 보내요.
            </p>
          </Card>
          {missing.length > 0 && (
            <Card title="퇴근 기록이 빠진 근무" meta={`${missing.length}건`} flush>
              <TableWrap>
                <table className="pm-table">
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>근무일</th>
                      <th>출근</th>
                      <th>
                        <span className="pm-sr">동작</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {missing.map((m) => (
                      <tr key={`${m.staffId}${m.date}${m.in}`}>
                        <td>
                          <strong>{m.name}</strong>
                        </td>
                        <td className="num">
                          {m.date.slice(5).replace("-", ".")} ({weekdayKo(m.date)})
                        </td>
                        <td className="num">{m.in}</td>
                        <td className="is-num">
                          <PmButton
                            size="sm"
                            icon="edit"
                            onClick={() => setDialog({ kind: "edit", staffId: m.staffId, missing: m })}
                          >
                            기록 수정
                          </PmButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              <p className="st-foot">최근 31일 기록이에요. 퇴근 시각을 넣어야 그 달 급여를 확정할 수 있어요.</p>
            </Card>
          )}
        </>
      )}

      {tab === "schedule" && (
        <Card
          title={thisWeek ? "이번 주 교대표" : "교대표"}
          meta={
            <span className="st-week">
              {actions ? (
                <Link
                  className="st-week__nav"
                  aria-label="지난 주"
                  href={weekHref(addDays(weekStart, -7))}
                  scroll={false}
                >
                  <Icon name="chevronLeft" size={16} />
                </Link>
              ) : null}
              <span className="num">
                {data.week.dates[0].slice(5).replace("-", ".")} ~ {data.week.dates[6].slice(5).replace("-", ".")}
              </span>
              {actions ? (
                <Link
                  className="st-week__nav"
                  aria-label="다음 주"
                  href={weekHref(addDays(weekStart, 7))}
                  scroll={false}
                >
                  <Icon name="chevron" size={16} />
                </Link>
              ) : null}
              {actions && !thisWeek && (
                <Link className="st-week__today" href={weekHref(null)} scroll={false}>
                  이번 주로
                </Link>
              )}
            </span>
          }
          flush
        >
          <TableWrap>
            <table className="pm-table st-sched">
              <thead>
                <tr>
                  <th>직원</th>
                  {data.week.dates.map((d) => (
                    <th key={d} className={cx("st-sched__day", d === data.date && "is-today")}>
                      {weekdayKo(d)} <span className="num">{Number(d.slice(8))}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.length === 0 && (
                  <tr>
                    <td colSpan={8} className="is-muted st-empty">
                      직원을 등록하면 교대표를 짤 수 있어요.
                    </td>
                  </tr>
                )}
                {active.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.name}</strong> <small className="is-muted">{ROLE[m.role]}</small>
                    </td>
                    {data.week.dates.map((d, i) => {
                      const k = shiftOf(m.id, i);
                      const saving = savingCell === `${m.id}:${i}`;
                      return (
                        <td key={d} className="st-sched__cell">
                          <button
                            type="button"
                            className={cx("st-shift", `is-${k}`)}
                            onClick={() => void cycle(m.id, i)}
                            disabled={saving}
                            aria-busy={saving || undefined}
                            aria-label={`${m.name} ${weekdayKo(d)} ${SHIFT[k]} — 눌러서 바꾸기`}
                          >
                            {SHIFT[k]}
                            {k !== "off" && k !== "unset" && (
                              <small className="st-shift__time">{SHIFT_TIME[k].hours}</small>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>근무 인원</td>
                  {data.week.dates.map((d, i) => {
                    const day = active.filter((m) => shiftOf(m.id, i) === "day").length;
                    const night = active.filter((m) => shiftOf(m.id, i) === "night").length;
                    return (
                      <td key={d} className={cx("st-sched__sum num", night === 0 && "is-gap")}>
                        낮 {day} &nbsp;밤 {night}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </TableWrap>
          <p className="st-foot">
            칸을 눌러 낮, 밤, 휴무로 바꿔요. 근무표를 아직 안 짠 날은 &lsquo;미정&rsquo;이에요. 밤 근무자가 없는 날은
            빨간색으로 표시돼요. 바꾼 칸은 바로 저장돼요.
          </p>
        </Card>
      )}

      {tab === "payroll" && owner && (
        <>
          {payMonths && payMonths.length > 1 && (
            <div className="st-month">
              <label htmlFor="st-pay-month">급여 달</label>
              <select
                id="st-pay-month"
                className="pm-input st-month__select"
                value={pay.month}
                onChange={(e) => pickMonth(e.target.value)}
              >
                {payMonths.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                    {m === data.month ? " (진행 중)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <StatRow cols={3}>
            <Stat
              label={`${Number(pay.month.slice(5))}월 급여 합계`}
              prefix="₩"
              value={formatNumber(payTotal)}
              foot={`${payRows.length}명`}
            />
            <Stat
              label="확정"
              value={allConfirmed ? "확정됨" : monthEnded ? "확정 전" : "진행 중"}
              text
              foot={
                allConfirmed
                  ? "명세서를 보내기 전까지 확정을 취소할 수 있어요"
                  : monthEnded
                    ? "근무 기록을 확인하고 확정해 주세요"
                    : "달이 끝나면 확정할 수 있어요"
              }
            />
            <Stat
              label="명세서"
              value={`${sentCount} / ${payRows.length}`}
              foot={sentCount ? "문자로 보냄" : allConfirmed ? "아직 보내지 않음" : "확정 전"}
            />
          </StatRow>
          <Card
            title={`${monthLabel(pay.month)} 급여 계산`}
            meta="근무시간 × 시급 + 야간 50% + 주휴수당"
            action={
              payRows.length === 0 ? undefined : allConfirmed ? (
                <span className="st-row-actions">
                  {!allSent && sentCount === 0 && (
                    <PmButton
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => actions!.payroll(pay.month, "reopen"),
                          `${monthLabel(pay.month)} 급여 확정을 취소했어요. 고친 뒤 다시 확정해 주세요.`,
                        )
                      }
                    >
                      확정 취소
                    </PmButton>
                  )}
                  <PmButton
                    size="sm"
                    variant="navy"
                    disabled={pending || allSent}
                    onClick={() =>
                      run(() => actions!.payroll(pay.month, "send"), "급여명세를 직원들에게 문자로 보냈어요.")
                    }
                  >
                    {allSent ? "모두 보냄" : "명세서 일괄 보내기"}
                  </PmButton>
                </span>
              ) : (
                <span className="st-row-actions">
                  {!monthEnded && <span className="st-why">달이 끝난 뒤 확정할 수 있어요</span>}
                  <PmButton
                    size="sm"
                    variant="navy"
                    disabled={pending || !monthEnded}
                    onClick={() =>
                      run(() => actions!.payroll(pay.month, "confirm"), `${monthLabel(pay.month)} 급여를 확정했어요.`)
                    }
                  >
                    급여 확정
                  </PmButton>
                </span>
              )
            }
            flush
          >
            <TableWrap>
              <table className="pm-table">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th className="is-num">근무</th>
                    <th className="is-num">야간</th>
                    <th className="is-num">기본급(원)</th>
                    <th className="is-num">야간수당(원)</th>
                    <th className="is-num">주휴수당(원)</th>
                    <th className="is-num">합계(원)</th>
                  </tr>
                </thead>
                <tbody>
                  {payRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="is-muted st-empty">
                        {monthLabel(pay.month)}에 계산할 근무 기록이 없어요.
                      </td>
                    </tr>
                  )}
                  {payRows.map((p) => {
                    const m = byId[p.staffId];
                    const low = m.pay.type === "hourly" && m.pay.amount < data.minimumWage;
                    return (
                      <tr key={p.staffId}>
                        <td>
                          <strong>{m.name}</strong> {low && <Badge tone="bad">최저임금 미달</Badge>}
                        </td>
                        <td className="is-num">{formatHours(p.hours)}</td>
                        <td className="is-num">{p.nightHours ? formatHours(p.nightHours) : "–"}</td>
                        <td className="is-num">{formatNumber(p.base)}</td>
                        <td className="is-num">{p.night ? formatNumber(p.night) : "–"}</td>
                        <td className="is-num">{p.weekly ? formatNumber(p.weekly) : "–"}</td>
                        <td className="is-num">
                          <strong>{formatNumber(p.total)}</strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {payRows.length > 0 && (
                  <tfoot>
                    <tr>
                      <td>합계</td>
                      <td className="is-num">{formatHours(payRows.reduce((s, p) => s + p.hours, 0))}</td>
                      <td className="is-num">{formatHours(payRows.reduce((s, p) => s + p.nightHours, 0))}</td>
                      <td className="is-num">{formatNumber(payRows.reduce((s, p) => s + p.base, 0))}</td>
                      <td className="is-num">{formatNumber(payRows.reduce((s, p) => s + p.night, 0))}</td>
                      <td className="is-num">{formatNumber(payRows.reduce((s, p) => s + p.weekly, 0))}</td>
                      <td className="is-num">{formatNumber(payTotal)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </TableWrap>
            <p className="st-foot">
              4대보험·원천세를 떼기 전 금액이에요. 확정한 뒤에도 명세서를 보내기 전이면 확정을 취소할 수 있어요.
            </p>
          </Card>
        </>
      )}
      {dialog?.kind === "add" && (
        <AddEmployeeDialog
          minimumWage={data.minimumWage}
          today={data.date}
          owner={owner}
          error={note?.bad ? note.text : null}
          pending={pending}
          onClose={() => setDialog(null)}
          onSubmit={(input) =>
            run(
              () => actions!.addEmployee(input),
              owner
                ? `${input.name}님을 등록했어요. 근로계약서를 보내 주세요.`
                : `${input.name}님을 등록했어요. 급여와 근로계약서는 사장님이 정해요.`,
              () => setDialog(null),
            )
          }
        />
      )}
      {dialog?.kind === "member" && byId[dialog.staffId] && (
        <EditEmployeeDialog
          member={byId[dialog.staffId]}
          minimumWage={data.minimumWage}
          today={data.date}
          focusPay={dialog.focusPay}
          owner={owner}
          error={note?.bad ? note.text : null}
          pending={pending}
          onClose={() => setDialog(null)}
          onSubmit={(input) =>
            run(
              () => actions!.updateEmployee(dialog.staffId, input),
              input.resignedDate
                ? `${byId[dialog.staffId].name}님을 퇴사 처리했어요.`
                : `${byId[dialog.staffId].name}님 정보를 고쳤어요.`,
              () => setDialog(null),
            )
          }
        />
      )}
      {dialog?.kind === "edit" && byId[dialog.staffId] && (
        <EditAttendanceDialog
          name={byId[dialog.staffId].name}
          row={
            dialog.missing
              ? { staffId: dialog.staffId, in: dialog.missing.in, status: "missing-out" }
              : dialog.day
                ? { staffId: dialog.staffId, in: dialog.day.in, out: dialog.day.out, status: "done" }
                : attendRows.find((a) => a.staffId === dialog.staffId)
          }
          date={dialog.missing?.date ?? dialog.day?.date ?? attendDay}
          today={data.date}
          error={note?.bad ? note.text : null}
          pending={pending}
          onClose={() =>
            setDialog(dialog.day ? { kind: "month", staffId: dialog.staffId, month: dialog.day.month } : null)
          }
          onSubmit={(input) =>
            run(
              () => actions!.editAttendance({ staffId: dialog.staffId, ...input }),
              "출퇴근 기록을 고쳤어요. 수정 이력이 남아요.",
              () => setDialog(dialog.day ? { kind: "month", staffId: dialog.staffId, month: dialog.day.month } : null),
            )
          }
        />
      )}
      {dialog?.kind === "month" && byId[dialog.staffId] && loadMonth && (
        <MonthDialog
          name={byId[dialog.staffId].name}
          staffId={dialog.staffId}
          initialMonth={dialog.month ?? data.date.slice(0, 7)}
          thisMonth={data.date.slice(0, 7)}
          load={loadMonth}
          onClose={() => setDialog(null)}
          onEdit={(day, month) =>
            setDialog({
              kind: "edit",
              staffId: dialog.staffId,
              day: { date: day.date, in: day.in, out: day.out, month },
            })
          }
        />
      )}
    </div>
  );
}

function AddEmployeeDialog({
  minimumWage,
  today,
  owner,
  error,
  pending,
  onClose,
  onSubmit,
}: {
  minimumWage: number;
  today: string;
  /** false(매니저): 급여 칸 없음 — 그해 최저시급 시급제로 등록되고 사장님이 정한다 */
  owner: boolean;
  error: string | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: Parameters<StaffActions["addEmployee"]>[0]) => void;
}) {
  const [f, setF] = useState({
    name: "",
    phone: "",
    role: "front" as StaffRole,
    payType: "hourly" as "hourly" | "monthly",
    payAmount: String(minimumWage),
    hiredDate: today,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));
  const amount = Number(f.payAmount.replace(/\D/g, ""));
  const low = owner && f.payType === "hourly" && amount > 0 && amount < minimumWage;
  return (
    <Modal
      title="직원 추가"
      desc={
        owner ? "등록한 뒤 근로계약서를 문자로 보낼 수 있어요." : "등록하면 사장님이 급여를 정하고 근로계약서를 보내요."
      }
      onClose={onClose}
      footer={
        <>
          <PmButton variant="ghost" onClick={onClose}>
            취소
          </PmButton>
          <PmButton
            variant="primary"
            disabled={pending || !f.name.trim() || !f.phone.trim() || (owner && !amount)}
            onClick={() =>
              onSubmit(
                owner
                  ? { ...f, name: f.name.trim(), payAmount: amount }
                  : { name: f.name.trim(), phone: f.phone, role: f.role, hiredDate: f.hiredDate },
              )
            }
          >
            {pending ? "저장 중…" : "등록"}
          </PmButton>
        </>
      }
    >
      <Field label="이름" required>
        <input className="pm-input" value={f.name} onChange={set("name")} />
      </Field>
      <Field label="휴대폰 번호" required hint="근로계약서·급여명세를 이 번호로 보내요.">
        <input
          className="pm-input"
          inputMode="tel"
          placeholder="010-0000-0000"
          value={f.phone}
          onChange={set("phone")}
        />
      </Field>
      <Field label="역할">
        <select className="pm-input" value={f.role} onChange={set("role")}>
          {(Object.keys(ROLE) as StaffRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE[r]}
            </option>
          ))}
        </select>
      </Field>
      {owner ? (
        <Field label="급여 기준">
          <div className="st-pay">
            <select className="pm-input" aria-label="급여 종류" value={f.payType} onChange={set("payType")}>
              <option value="hourly">시급</option>
              <option value="monthly">월급</option>
            </select>
            <input
              className="pm-input"
              aria-label="급여 금액(원)"
              inputMode="numeric"
              value={f.payAmount}
              onChange={set("payAmount")}
            />
          </div>
        </Field>
      ) : (
        <p className="st-hint">급여는 사장님이 정해요. 우선 {today.slice(0, 4)}년 최저시급 시급제로 등록돼요.</p>
      )}
      {low && (
        <p className="pm-error" role="alert">
          {today.slice(0, 4)}년 최저시급({won(minimumWage)})보다 낮아요.
        </p>
      )}
      <Field label="입사일">
        <input className="pm-input" type="date" value={f.hiredDate} onChange={set("hiredDate")} />
      </Field>
      {error && (
        <p className="pm-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

const MONTH_STATUS: Record<StaffMonthAttendance["days"][number]["status"], { tone: BadgeTone; label: string }> = {
  done: { tone: "neutral", label: "퇴근" },
  working: { tone: "ok", label: "근무 중" },
  "missing-out": { tone: "warn", label: "퇴근 누락" },
  absent: { tone: "warn", label: "기록 없음" },
  scheduled: { tone: "neutral", label: "근무 예정" },
};

/** 직원 한 명의 한 달 출퇴근 — 날짜별 기록, 줄마다 고치기, 달 이동 (P-11) */
function MonthDialog({
  name,
  staffId,
  initialMonth,
  thisMonth,
  load,
  onClose,
  onEdit,
}: {
  name: string;
  staffId: string;
  initialMonth: string;
  thisMonth: string;
  load: NonNullable<StaffScreenProps["loadMonth"]>;
  onClose: () => void;
  onEdit: (day: StaffMonthAttendance["days"][number], month: string) => void;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [res, setRes] = useState<{ month: string; data?: StaffMonthAttendance; error?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    void load(staffId, month).then((r) => {
      if (alive) setRes(r.ok ? { month, data: r.data } : { month, error: r.message });
    });
    return () => {
      alive = false;
    };
  }, [load, staffId, month]);
  const shiftMonth = (n: number) => {
    const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const loading = !res || res.month !== month;
  const d = loading ? undefined : res.data;
  return (
    <Modal
      wide
      title={`${name} 출퇴근 기록`}
      desc="날짜별 출퇴근이에요. 틀린 날은 고치기를 눌러 바로잡아요. 고친 사유는 기록에 남아요."
      onClose={onClose}
      footer={
        <PmButton variant="ghost" onClick={onClose}>
          닫기
        </PmButton>
      }
    >
      <div className="st-week st-monthnav">
        <button type="button" className="st-week__nav" aria-label="지난달" onClick={() => shiftMonth(-1)}>
          <Icon name="chevronLeft" size={16} />
        </button>
        <strong className="num">{monthLabel(month)}</strong>
        <button
          type="button"
          className="st-week__nav"
          aria-label="다음 달"
          disabled={month >= thisMonth}
          onClick={() => shiftMonth(1)}
        >
          <Icon name="chevron" size={16} />
        </button>
        {d && (
          <span className="is-muted num">
            {d.workedDays}일 근무, {d.totalHours}시간
          </span>
        )}
      </div>
      {d?.locked && <p className="st-hint">이 달 급여가 확정돼 고칠 수 없어요. 급여 확정을 풀면 고칠 수 있어요.</p>}
      {loading ? (
        <p className="is-muted" aria-busy="true">
          불러오는 중…
        </p>
      ) : res.error ? (
        <p className="pm-error" role="alert">
          {res.error}
        </p>
      ) : d && d.days.length === 0 ? (
        <p className="is-muted">이 달에는 출퇴근 기록도, 근무표도 없어요.</p>
      ) : (
        d && (
          <TableWrap>
            <table className="pm-table st-monthtable">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>근무표</th>
                  <th>출근</th>
                  <th>퇴근</th>
                  <th className="is-num">시간</th>
                  <th>상태</th>
                  <th>
                    <span className="pm-sr">동작</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.days.map((x) => {
                  const st = MONTH_STATUS[x.status];
                  return (
                    <tr key={x.date}>
                      <td className="num">
                        {x.date.slice(5).replace("-", ".")} ({weekdayKo(x.date)})
                      </td>
                      <td>{SHIFT[x.shift]}</td>
                      <td className="num">{x.in ?? <span className="is-muted">-</span>}</td>
                      <td className="num">{x.out ?? <span className="is-muted">-</span>}</td>
                      <td className="is-num">{x.hours != null ? `${x.hours}시간` : ""}</td>
                      <td>
                        {x.status === "done" ? (
                          <span className="is-muted">{st.label}</span>
                        ) : (
                          <Badge tone={st.tone}>{st.label}</Badge>
                        )}
                        {x.edited && (
                          <small className="st-editnote" title={x.editedBy ? `${x.editedBy}님이 고침` : "고친 기록"}>
                            고침{x.memo ? `: ${x.memo}` : ""}
                          </small>
                        )}
                      </td>
                      <td className="is-num">
                        {x.status !== "scheduled" && (
                          <PmButton
                            size="sm"
                            variant={x.status === "missing-out" || x.status === "absent" ? "ghost" : "quiet"}
                            icon="edit"
                            disabled={d.locked}
                            onClick={() => onEdit(x, month)}
                          >
                            고치기
                          </PmButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )
      )}
    </Modal>
  );
}

function EditAttendanceDialog({
  name,
  row,
  date,
  today,
  error,
  pending,
  onClose,
  onSubmit,
}: {
  name: string;
  row?: AttendanceRow;
  /** 고칠 근무일 (기본 오늘) */
  date: string;
  /** 오늘 — 근무일은 오늘까지만 */
  today: string;
  error: string | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: { date: string; clockIn: string; clockOut?: string; memo?: string }) => void;
}) {
  const [f, setF] = useState({ date, clockIn: row?.in ?? "09:00", clockOut: row?.out ?? "", memo: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal
      title={`${name} 출퇴근 기록 수정`}
      desc="고친 사람과 시각이 기록에 남아요. 퇴근이 출근보다 이르면 다음 날 퇴근으로 봐요."
      onClose={onClose}
      footer={
        <>
          <PmButton variant="ghost" onClick={onClose}>
            취소
          </PmButton>
          <PmButton variant="primary" disabled={pending || !f.clockIn || f.date > today} onClick={() => onSubmit(f)}>
            {pending ? "저장 중…" : "변경 저장"}
          </PmButton>
        </>
      }
    >
      <Field label="근무일">
        <input className="pm-input" type="date" max={today} value={f.date} onChange={set("date")} />
      </Field>
      <div className="st-pay">
        <Field label="출근">
          <input className="pm-input" type="time" value={f.clockIn} onChange={set("clockIn")} />
        </Field>
        <Field label="퇴근">
          <input className="pm-input" type="time" value={f.clockOut} onChange={set("clockOut")} />
        </Field>
      </div>
      <Field label="수정 사유">
        <input className="pm-input" placeholder="예: 퇴근 버튼 누락" value={f.memo} onChange={set("memo")} />
      </Field>
      {error && (
        <p className="pm-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

function EditEmployeeDialog({
  member,
  minimumWage,
  today,
  focusPay,
  owner,
  error,
  pending,
  onClose,
  onSubmit,
}: {
  member: StaffMember;
  minimumWage: number;
  today: string;
  focusPay?: boolean;
  /** false(매니저): 급여 칸 없음 (사장님만 정함) */
  owner: boolean;
  error: string | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: Parameters<StaffActions["updateEmployee"]>[1]) => void;
}) {
  const [f, setF] = useState({
    phone: member.phone,
    role: member.role,
    payType: member.pay.type,
    payAmount: String(member.pay.amount),
    resign: false,
    resignedDate: today,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));
  const amount = Number(f.payAmount.replace(/\D/g, ""));
  const low = f.payType === "hourly" && amount > 0 && amount < minimumWage;
  const submit = () => {
    const input: Parameters<StaffActions["updateEmployee"]>[1] = {};
    if (f.phone.trim() !== member.phone) input.phone = f.phone.trim();
    if (f.role !== member.role) input.role = f.role;
    if (owner && f.payType !== member.pay.type) input.payType = f.payType;
    if (owner && (amount !== member.pay.amount || f.payType !== member.pay.type)) input.payAmount = amount;
    if (f.resign) input.resignedDate = f.resignedDate;
    onSubmit(input);
  };
  return (
    <Modal
      title={`${member.name} 정보 고치기`}
      desc={
        owner
          ? "바꾼 급여는 아직 확정하지 않은 달의 급여 계산에 바로 반영돼요."
          : "급여(시급·월급)는 사장님만 바꿀 수 있어요."
      }
      onClose={onClose}
      footer={
        <>
          <PmButton variant="ghost" onClick={onClose}>
            취소
          </PmButton>
          <PmButton variant="primary" disabled={pending || (owner && !amount) || !f.phone.trim()} onClick={submit}>
            {pending ? "저장 중…" : f.resign ? "퇴사 처리" : "변경 저장"}
          </PmButton>
        </>
      }
    >
      {focusPay ? null : (
        <Field label="휴대폰 번호" hint="근로계약서·급여명세를 이 번호로 보내요.">
          <input className="pm-input" inputMode="tel" value={f.phone} onChange={set("phone")} />
        </Field>
      )}
      {owner && (
        <Field label="급여 기준" required>
          <div className="st-pay">
            <select className="pm-input" aria-label="급여 종류" value={f.payType} onChange={set("payType")}>
              <option value="hourly">시급</option>
              <option value="monthly">월급</option>
            </select>
            <input
              className="pm-input num"
              aria-label="급여 금액(원)"
              inputMode="numeric"
              value={f.payAmount}
              onChange={set("payAmount")}
            />
          </div>
        </Field>
      )}
      {owner &&
        (low ? (
          <p className="pm-error" role="alert">
            {today.slice(0, 4)}년 최저시급({won(minimumWage)})보다 낮아요.
          </p>
        ) : (
          f.payType === "hourly" && (
            <p className="st-hint">
              {today.slice(0, 4)}년 최저시급은 {won(minimumWage)}이에요.
            </p>
          )
        ))}
      {focusPay ? null : (
        <>
          <Field label="역할">
            <select className="pm-input" value={f.role} onChange={set("role")}>
              {(Object.keys(ROLE) as StaffRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE[r]}
                </option>
              ))}
            </select>
          </Field>
          {!member.resigned && (
            <div className="st-resign">
              <label className="st-resign__check">
                <input
                  type="checkbox"
                  checked={f.resign}
                  onChange={(e) => setF((x) => ({ ...x, resign: e.target.checked }))}
                />
                퇴사 처리
              </label>
              {f.resign && (
                <Field label="퇴사일" required hint="퇴사일 다음 날부터 교대표·출퇴근에서 빠져요.">
                  <input className="pm-input" type="date" value={f.resignedDate} onChange={set("resignedDate")} />
                </Field>
              )}
            </div>
          )}
        </>
      )}
      {error && (
        <p className="pm-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

/**
 * 실패 안내 — 급여 확정·출퇴근 수정이 막힌 까닭과 고칠 곳.
 * 문구는 API 가 주는 한국어를 그대로 쓰고, 고칠 곳으로 가는 버튼을 붙인다.
 */
function failNote(r: { message: string; errorCode?: string }, owner: boolean): Note {
  switch (r.errorCode) {
    case "MISSING_CLOCK_OUT":
      return { bad: true, text: r.message, fix: { label: "근태에서 퇴근 기록 고치기", tab: "attendance" } };
    case "BELOW_MINIMUM_WAGE":
      return {
        bad: true,
        text: `${r.message} 직원·계약에서 시급을 고칠 수 있어요.`,
        fix: { label: "직원·계약에서 시급 고치기", tab: "members" },
      };
    case "PAYROLL_LOCKED":
      return owner
        ? { bad: true, text: r.message, fix: { label: "급여에서 확정 취소하기", tab: "payroll" } }
        : { bad: true, text: "이 달 급여가 확정돼서 고칠 수 없어요. 사장님께 급여 확정을 풀어 달라고 해 주세요." };
    default:
      return { bad: true, text: r.message };
  }
}
