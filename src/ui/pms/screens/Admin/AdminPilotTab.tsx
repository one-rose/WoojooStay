"use client";

import { useState, useTransition } from "react";
import type { AdminPilotActions, AdminPilotKpi, AdminPilotProperty, AdminPilotSurvey, AdminPilotWeek } from "@/core";
import { Badge, Card, Field, Modal, TableWrap } from "../../components";
import { AxButton, AxTextField } from "../../components/Astryx";

/** 비율 → "66.7%" (없으면 -) */
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "-" : `${Math.round(v * 1000) / 10}%`);
const num = (v: number | null | undefined, unit = "") => (v === null || v === undefined ? "-" : `${v}${unit}`);
const signed = (v: number | null | undefined) =>
  v === null || v === undefined ? "-" : `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
const md = (iso: string) => `${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))}`;

type Metric = {
  label: string;
  value: (w: AdminPilotWeek) => string;
  /** 정의 문구 키 (definitions) */
  def?: string;
};

/** 주별 표의 줄 — 사업소개서 KPI 순서 (리뷰 → 장부 → 인력 → 지출 → 평점) */
const METRICS: Metric[] = [
  { label: "리뷰 응답률", value: (w) => `${pct(w.responseRate)}`, def: "responseRate" },
  { label: "답글 단 리뷰 / 올라온 리뷰", value: (w) => `${num(w.answered)} / ${num(w.reviews)}` },
  { label: "응답 소요 중앙값", value: (w) => num(w.medianResponseHours, "시간"), def: "responseTime" },
  { label: "AI 초안 그대로 게시", value: (w) => pct(w.draftAsIsRate), def: "draftAsIs" },
  { label: "앱 사용일", value: (w) => num(w.activeDays, "일"), def: "activeDays" },
  { label: "장부·통합 현황 조회일", value: (w) => num(w.ledgerDays, "일"), def: "ledgerDays" },
  { label: "지출 디지털 비율", value: (w) => pct(w.expenseDigitalRate), def: "expenseDigital" },
  { label: "급여 확정 / 명세 발송", value: (w) => `${num(w.payrollConfirmed)} / ${num(w.payslipsSent)}` },
  { label: "근로계약 서명", value: (w) => num(w.contractsSigned, "건") },
  { label: "출근 앱 기록 비율", value: (w) => pct(w.attendanceAppRate), def: "attendanceApp" },
  { label: "채널 평점 평균", value: (w) => num(w.rating), def: "rating" },
  { label: "평점 변화 (기준선 대비)", value: (w) => (w.week === 0 ? "기준" : signed(w.ratingDelta)) },
  {
    label: "AI 초안 / 다시 쓰기 / 게시",
    value: (w) => `${num(w.aiDrafts)} / ${num(w.aiRegenerations)} / ${num(w.aiPosts)}`,
    def: "aiUsage",
  },
];

const SURVEY_NUM: { key: keyof AdminPilotSurvey; label: string; unit?: string; max?: number }[] = [
  { key: "channelCheckMinutes", label: "하루 채널 확인 시간", unit: "분" },
  { key: "payrollMinutes", label: "한 달 급여 계산 시간", unit: "분" },
  { key: "staffCount", label: "알바 수", unit: "명" },
  { key: "monthlyExpenseCount", label: "한 달 지출 건수", unit: "건" },
];

/** 지금 주 (진행 중이면 그 주, 아직 시작 전이면 기준선) */
function current(p: AdminPilotProperty): AdminPilotWeek | undefined {
  return p.weeks[p.pilot.week] ?? p.weeks[0];
}

/**
 * 운영자 '실증 KPI' — 실증 업장 × 기준선·1~8주.
 * 위: 업장별 이번 주 요약 (행을 누르면 아래 주별 표가 그 업장으로), 아래: 주별 표 + 정의 문구 + 설문 값 입력.
 */
export function AdminPilotTab({ kpi: initial, actions }: { kpi: AdminPilotKpi; actions?: AdminPilotActions }) {
  const [kpi, setKpi] = useState(initial);
  const [selected, setSelected] = useState<string | null>(initial.properties[0]?.id ?? null);
  const [editing, setEditing] = useState<AdminPilotProperty | null>(null);
  const [note, setNote] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const p = kpi.properties.find((x) => x.id === selected) ?? kpi.properties[0];
  const first = kpi.properties[0];
  const csv = `/admin/pilot/export${kpi.group ? `?group=${encodeURIComponent(kpi.group)}` : ""}`;

  const changeGroup = (g: string) =>
    start(async () => {
      if (!actions) return;
      const r = await actions.loadPilot(g);
      if (!r.ok) return setNote({ bad: true, text: r.message });
      setKpi(r.data);
      setSelected(r.data.properties[0]?.id ?? null);
    });

  if (kpi.properties.length === 0) {
    return (
      <Card>
        <p className="ad-detail__muted">
          아직 실증 업장이 없어요. 업장 목록에서 업장을 열고 &lsquo;실증&rsquo; 칸에 묶음 이름과 시작일을 넣어 주세요.
        </p>
      </Card>
    );
  }

  return (
    <div className="ad-pilot">
      <div className="ad-pilot__bar">
        {kpi.groups.length > 1 ? (
          <select
            className="pm-input"
            value={kpi.group ?? ""}
            onChange={(e) => changeGroup(e.target.value)}
            aria-label="실증 묶음"
            disabled={pending}
          >
            {kpi.groups.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name} ({g.properties}곳)
              </option>
            ))}
          </select>
        ) : (
          <strong className="ad-pilot__group">{kpi.group}</strong>
        )}
        {first && (
          <span className="ad-pilot__when num">
            {first.pilot.startedAt.replaceAll("-", ".")} 시작, {first.pilot.endsAt.replaceAll("-", ".")}까지
            {first.pilot.week > 0 ? `, 지금 ${first.pilot.week}주 차` : ", 시작 전"}
          </span>
        )}
        <a className="pm-btn pm-btn--ghost pm-btn--sm ad-pilot__csv" href={csv} download>
          <span>CSV 내려받기</span>
        </a>
      </div>
      {note && <p className={note.bad ? "ad-note is-bad" : "ad-note"}>{note.text}</p>}

      <Card flush>
        <TableWrap>
          <table className="pm-table ad-pilot__summary">
            <thead>
              <tr>
                <th>업장</th>
                <th>활성화</th>
                <th>최근 접속</th>
                <th className="is-num">응답률 기준선</th>
                <th className="is-num">이번 주</th>
                <th className="is-num">응답 소요</th>
                <th className="is-num">초안 그대로</th>
                <th className="is-num">사용일</th>
                <th className="is-num">평점 변화</th>
                <th>설문</th>
              </tr>
            </thead>
            <tbody>
              {kpi.properties.map((x) => {
                const w = current(x);
                const blocked = x.activation?.blocked
                  ? x.activation.steps.find((s) => s.key === x.activation?.blocked)?.label
                  : null;
                return (
                  <tr
                    key={x.id}
                    className={x.id === p?.id ? "ad-row is-on" : "ad-row"}
                    onClick={() => setSelected(x.id)}
                    aria-selected={x.id === p?.id}
                  >
                    <td>
                      <button type="button" className="ad-row__open" onClick={() => setSelected(x.id)}>
                        <strong>{x.name}</strong>
                      </button>
                    </td>
                    <td>{blocked ? <Badge tone="warn">{blocked} 전</Badge> : <Badge tone="ok">첫 답글까지</Badge>}</td>
                    <td className="num is-muted">{x.lastLoginAt?.slice(5).replace("-", ".") ?? "접속 없음"}</td>
                    <td className="is-num">{pct(x.weeks[0]?.responseRate)}</td>
                    <td className="is-num">
                      <strong>{pct(w?.responseRate)}</strong>
                    </td>
                    <td className="is-num">{num(w?.medianResponseHours, "시간")}</td>
                    <td className="is-num">{pct(w?.draftAsIsRate)}</td>
                    <td className="is-num">
                      {num(w?.activeDays)}
                      <span className="is-muted">/{w?.days ?? 0}일</span>
                    </td>
                    <td className={`is-num ${(w?.ratingDelta ?? 0) > 0 ? "is-up" : ""}`}>{signed(w?.ratingDelta)}</td>
                    <td>
                      <AxButton
                        size="sm"
                        variant="quiet"
                        onClick={() => {
                          setEditing(x);
                          setNote(null);
                        }}
                      >
                        {x.survey ? "고치기" : "입력"}
                      </AxButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {p && (
        <Card
          flush
          title={`${p.name} 주별 KPI`}
          meta={`시작 ${p.pilot.startedAt.replaceAll("-", ".")}`}
          className="ad-pilot__weeks"
        >
          <TableWrap>
            <table className="pm-table ad-pilot__grid">
              <thead>
                <tr>
                  <th scope="col">지표</th>
                  {p.weeks.map((w) => (
                    <th key={w.week} scope="col" className={w.week === p.pilot.week ? "is-num is-now" : "is-num"}>
                      {w.week === 0 ? "기준선" : `${w.week}주`}
                      <small className="num">
                        {w.week === 0 ? `${w.days}일` : `${md(w.from)}~${md(w.to)}`}
                        {w.partial && w.week > 0 ? " 진행 중" : ""}
                      </small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m) => (
                  <tr key={m.label}>
                    <th scope="row">{m.label}</th>
                    {p.weeks.map((w) => (
                      <td
                        key={w.week}
                        className={`is-num${w.future ? " is-muted" : ""}${w.week === p.pilot.week ? " is-now" : ""}`}
                      >
                        {w.future ? "" : m.value(w)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <dl className="ad-pilot__defs">
            {METRICS.filter((m) => m.def && kpi.definitions[m.def]).map((m) => (
              <div key={m.label}>
                <dt>{m.label}</dt>
                <dd>{kpi.definitions[m.def as string]}</dd>
              </div>
            ))}
            {kpi.definitions.week && (
              <div>
                <dt>주 나누기</dt>
                <dd>{kpi.definitions.week}</dd>
              </div>
            )}
          </dl>
          {p.survey && <SurveySummary survey={p.survey} />}
        </Card>
      )}

      {editing && (
        <SurveyModal
          property={editing}
          actions={actions}
          onClose={() => setEditing(null)}
          onSaved={(survey) => {
            setKpi((k) => ({
              ...k,
              properties: k.properties.map((x) => (x.id === editing.id ? { ...x, survey } : x)),
            }));
            setEditing(null);
            setNote({ bad: false, text: `${editing.name} 설문 값을 저장했어요.` });
          }}
        />
      )}
    </div>
  );
}

function SurveySummary({ survey: s }: { survey: AdminPilotSurvey }) {
  const items: [string, string][] = [
    ["하루 채널 확인", num(s.channelCheckMinutes, "분")],
    ["급여 계산", `${s.payrollMethod ?? "-"}${s.payrollMinutes ? `, 월 ${s.payrollMinutes}분` : ""}`],
    ["알바 수", num(s.staffCount, "명")],
    ["월 지출 건수", num(s.monthlyExpenseCount, "건")],
    ["기록 방식", s.recordMethod ?? "-"],
    ["만족도 4주 / 8주", `${num(s.satisfaction4w)} / ${num(s.satisfaction8w)}`],
    ["지불의사", s.wtpPlan ? `${s.wtpPlan}${s.wtpProperties ? `, ${s.wtpProperties}곳` : ""}` : "-"],
  ];
  return (
    <section className="ad-pilot__survey" aria-label="설문 값">
      <h3>설문 값</h3>
      <dl>
        {items.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className="num">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** 기준선 · 만족도 · 지불의사 입력 — 설문은 외부 폼, 운영팀이 옮겨 적는다 */
function SurveyModal({
  property,
  actions,
  onClose,
  onSaved,
}: {
  property: AdminPilotProperty;
  actions?: AdminPilotActions;
  onClose: () => void;
  onSaved: (s: AdminPilotSurvey) => void;
}) {
  const s = property.survey;
  const [form, setForm] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (s) for (const [k, v] of Object.entries(s)) out[k] = v === null ? "" : String(v);
    return out;
  });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = (k: keyof AdminPilotSurvey) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const val = (k: keyof AdminPilotSurvey) => form[k] ?? "";
  /** 아스트릭스 입력창은 값만 넘긴다 */
  const setV = (k: keyof AdminPilotSurvey) => (v: string) => set(k)({ target: { value: v } });

  const save = () =>
    start(async () => {
      const ints = [...SURVEY_NUM.map((x) => x.key), "satisfaction4w", "satisfaction8w", "wtpProperties"] as const;
      const texts = [
        "payrollMethod",
        "recordMethod",
        "baselineMemo",
        "satisfactionMemo",
        "wtpPlan",
        "wtpMemo",
      ] as const;
      const body: Partial<AdminPilotSurvey> = {};
      for (const k of ints) {
        const raw = (form[k] ?? "").trim();
        if (raw === "") {
          (body as Record<string, unknown>)[k] = null;
          continue;
        }
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0) return setError("숫자 칸에는 0 이상의 정수만 넣어 주세요.");
        if ((k === "satisfaction4w" || k === "satisfaction8w") && (n < 1 || n > 5))
          return setError("만족도는 1~5 사이로 넣어 주세요.");
        (body as Record<string, unknown>)[k] = n;
      }
      for (const k of texts) (body as Record<string, unknown>)[k] = (form[k] ?? "").trim() || null;
      if (!actions) {
        onSaved({ ...(s ?? ({} as AdminPilotSurvey)), ...body } as AdminPilotSurvey);
        return;
      }
      const r = await actions.saveSurvey(property.id, body);
      if (!r.ok) return setError(r.message);
      onSaved(r.data);
    });

  return (
    <Modal
      title={`${property.name} 설문 값`}
      desc="외부 설문 폼의 답을 옮겨 적어요. 비운 칸은 저장하지 않은 값으로 남아요."
      wide
      onClose={onClose}
      footer={
        <>
          <AxButton variant="ghost" onClick={onClose}>
            닫기
          </AxButton>
          <AxButton variant="primary" onClick={save} disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </AxButton>
        </>
      }
    >
      {!actions && <p className="ad-detail__muted">체험 모드라 이 화면에서만 바뀌어요.</p>}
      <div className="ad-survey">
        <fieldset>
          <legend>기준선 (실증 전)</legend>
          {SURVEY_NUM.map((x) => (
            <AxTextField
              key={x.key}
              label={`${x.label} (${x.unit})`}
              inputMode="numeric"
              value={val(x.key)}
              onChange={setV(x.key)}
            />
          ))}
          <AxTextField
            label="급여 계산 방식"
            hint="예: 엑셀, 수기 장부, 세무사 위탁"
            value={val("payrollMethod")}
            onChange={setV("payrollMethod")}
            maxLength={100}
          />
          <AxTextField
            label="지출·장부 기록 방식"
            value={val("recordMethod")}
            onChange={setV("recordMethod")}
            maxLength={100}
          />
          <Field label="메모">
            <textarea
              className="pm-input"
              rows={2}
              value={val("baselineMemo")}
              onChange={set("baselineMemo")}
              maxLength={1000}
            />
          </Field>
        </fieldset>
        <fieldset>
          <legend>만족도 (1~5)</legend>
          <AxTextField
            label="4주 차"
            inputMode="numeric"
            value={val("satisfaction4w")}
            onChange={setV("satisfaction4w")}
          />
          <AxTextField
            label="8주 차"
            inputMode="numeric"
            value={val("satisfaction8w")}
            onChange={setV("satisfaction8w")}
          />
          <Field label="메모">
            <textarea
              className="pm-input"
              rows={2}
              value={val("satisfactionMemo")}
              onChange={set("satisfactionMemo")}
              maxLength={1000}
            />
          </Field>
        </fieldset>
        <fieldset>
          <legend>지불의사</legend>
          <AxTextField
            label="고른 요금제"
            hint="예: 스타터, 베이직, 프로"
            value={val("wtpPlan")}
            onChange={setV("wtpPlan")}
            maxLength={50}
          />
          <AxTextField
            label="쓰겠다는 업장 수"
            inputMode="numeric"
            value={val("wtpProperties")}
            onChange={setV("wtpProperties")}
          />
          <Field label="메모">
            <textarea className="pm-input" rows={2} value={val("wtpMemo")} onChange={set("wtpMemo")} maxLength={1000} />
          </Field>
        </fieldset>
      </div>
      {error && (
        <p className="ad-note is-bad" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
