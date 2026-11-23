"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  changeRate,
  type ActionResult,
  type ExpenseActions,
  type ExpenseCategory,
  type ExpenseData,
  type ExpenseInput,
  type ExpenseItem,
  type PurchaseOrder,
} from "@/core";
import { cx, formatNumber, formatWon, josa } from "@/shared";
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
import "./expenses.css";

type Tab = "summary" | "receipt" | "orders";

const TABS = [
  { id: "summary", label: "지출 현황" },
  { id: "receipt", label: "영수증 등록" },
  { id: "orders", label: "발주" },
] as const;

export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  amenity: "객실용품",
  utility: "전기·가스·수도",
  laundry: "세탁·린넨",
  food: "조식 식자재",
  repair: "수리·설비",
  tax: "세금·공과금",
  etc: "기타",
};
const SOURCE = { card: "카드", receipt: "영수증", order: "발주", manual: "직접 입력" } as const;
const ORDER: Record<PurchaseOrder["status"], { tone: BadgeTone; label: string }> = {
  requested: { tone: "warn", label: "발주 요청" },
  ordered: { tone: "info", label: "배송 중" },
  received: { tone: "ok", label: "입고 완료" },
  cancelled: { tone: "neutral", label: "취소" },
};
const won = formatWon;

type Form = { vendor: string; date: string; amount: string; category: ExpenseCategory };
const emptyForm = (date: string): Form => ({ vendor: "", date, amount: "", category: "amenity" });
const fromItem = (e: ExpenseItem): Form => ({
  vendor: e.vendor,
  date: e.date,
  amount: formatNumber(e.amount),
  category: e.category,
});
const toInput = (f: Form): ExpenseInput => ({
  vendor: f.vendor.trim(),
  date: f.date,
  amount: Number(f.amount.replace(/\D/g, "")),
  category: f.category,
});
/** today: 지출 날짜는 오늘까지만 (API 도 미래 날짜는 받지 않는다) */
const filled = (f: Form, today: string) =>
  f.vendor.trim() !== "" &&
  /^\d{4}-\d{2}-\d{2}$/.test(f.date) &&
  f.date <= today &&
  Number(f.amount.replace(/\D/g, "")) > 0;
const shiftMonth = (m: string, n: number) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};

/** 지출관리 (F6-01 · F6-03 · F6-04). actions 가 없으면 예시 화면 */
export function ExpensesScreen({
  data,
  actions,
  today,
  navigable = false,
}: {
  data: ExpenseData;
  actions?: ExpenseActions;
  today?: string;
  /** 실서버면 이전·다음 달로 이동 (?month=YYYY-MM) */
  navigable?: boolean;
}) {
  const router = useRouter();
  const day = today ?? data.receiptSample.date;
  const thisMonth = day.slice(0, 7);
  const isThisMonth = data.month === thisMonth;
  const prevMonth = shiftMonth(data.month, -1);
  const nextMonth = shiftMonth(data.month, 1);
  const [tab, setTab] = useState<Tab>("summary");
  // 발주 상태: 서버 목록 위에 방금 바꾼 상태만 덮어쓴다 — 새로고침으로 목록이 바뀌면 버린다
  const [orderBase, setOrderBase] = useState(data.orders);
  const [orderStatus, setOrderStatus] = useState<Record<string, PurchaseOrder["status"]>>({});
  if (orderBase !== data.orders) {
    setOrderBase(data.orders);
    setOrderStatus({});
  }
  const orders = data.orders.map((o) => (orderStatus[o.id] ? { ...o, status: orderStatus[o.id] } : o));
  const [dialog, setDialog] = useState<
    { kind: "expense"; item?: ExpenseItem } | { kind: "order" } | { kind: "delete"; item: ExpenseItem } | null
  >(null);
  const [note, setNote] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const total = data.items.reduce((s, e) => s + e.amount, 0);
  // 이번 달이 진행 중이면 지난달 같은 날짜까지와 비교 (API 가 주면)
  const rate = changeRate(total, isThisMonth ? (data.prevTotalToDate ?? data.prevTotal) : data.prevTotal);
  const byCat = (Object.keys(EXPENSE_LABEL) as ExpenseCategory[])
    .map((c) => ({ c, amount: data.items.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0) }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const max = byCat[0]?.amount ?? 1;

  const run = (fn: () => Promise<ActionResult<unknown>>, done: string, after?: () => void) =>
    start(async () => {
      if (!actions) {
        after?.();
        return setNote({ bad: false, text: "체험 모드라 저장되지 않아요. 실제 서비스에서는 바로 반영돼요." });
      }
      const r = await fn();
      if (!r.ok) return setNote({ bad: true, text: r.message });
      after?.();
      setNote({ bad: false, text: done });
      router.refresh();
    });

  const moveOrder = (o: PurchaseOrder, status: "ordered" | "received") =>
    run(
      () => actions!.setOrderStatus(o.id, status),
      status === "received" ? `${o.item} 입고를 확인하고 지출로 등록했어요.` : `${josa(o.item, "을/를")} 발주했어요.`,
      () => setOrderStatus((prev) => ({ ...prev, [o.id]: status })),
    );

  const headActions =
    tab === "summary" ? (
      <>
        <PmButton icon="photo" onClick={() => setTab("receipt")}>
          영수증 올리기
        </PmButton>
        <PmButton variant="primary" icon="edit" onClick={() => setDialog({ kind: "expense" })}>
          지출 입력
        </PmButton>
      </>
    ) : tab === "receipt" ? (
      <PmButton icon="edit" onClick={() => setDialog({ kind: "expense" })}>
        영수증 없이 직접 입력
      </PmButton>
    ) : (
      <PmButton variant="primary" icon="edit" onClick={() => setDialog({ kind: "order" })}>
        발주 등록
      </PmButton>
    );

  return (
    <div className="ex">
      <PageHead
        title="지출관리"
        desc="객실용품·공과금·세탁비 같은 운영비를 항목별로 모아 매출과 함께 봐요."
        actions={headActions}
      />
      <Tabs items={TABS} value={tab} onChange={setTab} label="지출관리 보기" />
      {note && (
        <p className={cx("ex-msg", note.bad && "is-bad")} role={note.bad ? "alert" : "status"}>
          {note.text}
        </p>
      )}

      {tab === "summary" && (
        <>
          {navigable && (
            <div className="ex-month">
              <Link className="ex-month__nav" aria-label="이전 달" href={`?month=${prevMonth}`} scroll={false}>
                <Icon name="chevronLeft" size={16} />
              </Link>
              <strong>
                {data.month.slice(0, 4)}년 {Number(data.month.slice(5))}월
              </strong>
              {nextMonth <= thisMonth ? (
                <Link className="ex-month__nav" aria-label="다음 달" href={`?month=${nextMonth}`} scroll={false}>
                  <Icon name="chevron" size={16} />
                </Link>
              ) : (
                <button type="button" className="ex-month__nav" aria-label="다음 달" disabled>
                  <Icon name="chevron" size={16} />
                </button>
              )}
            </div>
          )}
          <StatRow cols={3}>
            <Stat
              icon="credit_card"
              label={`${Number(data.month.slice(5))}월 지출`}
              prefix="₩"
              value={formatNumber(total)}
              delta={{ rate, label: isThisMonth && navigable ? "지난달 같은 날보다" : "전월보다", good: "down" }}
            />
            <Stat
              icon="chart_increasing"
              label="매출 대비 지출"
              value={data.sales ? `${((total / data.sales) * 100).toFixed(1)}%` : "-"}
              foot={
                data.upcoming && isThisMonth ? `오늘까지 확정 매출 ${won(data.sales)}` : `예약매출 ${won(data.sales)}`
              }
            />
            <Stat
              label="가장 큰 항목"
              value={byCat[0] ? EXPENSE_LABEL[byCat[0].c] : "-"}
              text
              foot={byCat[0] ? won(byCat[0].amount) : "아직 지출이 없어요"}
            />
          </StatRow>
          <div className="ex-grid">
            <Card title="항목별 지출">
              {byCat.length === 0 && <p className="ex-empty">지출을 등록하면 항목별로 나눠 보여드려요.</p>}
              <ul className="ex-cats">
                {byCat.map(({ c, amount }) => (
                  <li key={c}>
                    <span>{EXPENSE_LABEL[c]}</span>
                    <span className="ex-cats__track">
                      <span className="ex-cats__fill" style={{ width: `${(amount / max) * 100}%` }} />
                    </span>
                    <strong className="num">{won(amount)}</strong>
                    <small className="num">{((amount / total) * 100).toFixed(1)}%</small>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="지출 내역" meta={`${data.items.length}건`} flush>
              <TableWrap>
                <table className="pm-table">
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th>가맹점</th>
                      <th>항목</th>
                      <th>출처</th>
                      <th className="is-num">금액</th>
                      <th>
                        <span className="pm-sr">동작</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.length === 0 && (
                      <tr>
                        <td colSpan={6} className="is-muted">
                          {isThisMonth ? "이번 달 지출이 아직 없어요." : "이 달 지출 기록이 없어요."}
                        </td>
                      </tr>
                    )}
                    {(actions ? data.items : [...data.items].reverse()).map((e) => (
                      <tr key={e.id}>
                        <td className="num">{e.date.slice(5).replace("-", ".")}</td>
                        <td>{e.vendor}</td>
                        <td>
                          <Badge>{EXPENSE_LABEL[e.category]}</Badge>
                        </td>
                        <td className="is-muted">{SOURCE[e.source]}</td>
                        <td className="is-num">{won(e.amount)}</td>
                        <td className="is-num">
                          <span className="ex-row-actions">
                            {e.receiptId && actions && (
                              // 원본 사진은 route handler 가 내 토큰으로 받아 흘려보낸다 (새 창)
                              <a
                                className="pm-btn pm-btn--quiet pm-btn--sm"
                                href={`/app/receipts/${e.receiptId}`}
                                target="_blank"
                                rel="noopener"
                                aria-label={`${e.vendor} 영수증 보기 (새 창)`}
                              >
                                영수증 보기
                              </a>
                            )}
                            <PmButton
                              size="sm"
                              variant="quiet"
                              aria-label={`${e.vendor} 지출 고치기`}
                              onClick={() => setDialog({ kind: "expense", item: e })}
                            >
                              고치기
                            </PmButton>
                            <PmButton
                              size="sm"
                              variant="quiet"
                              aria-label={`${e.vendor} 지출 지우기`}
                              onClick={() => setDialog({ kind: "delete", item: e })}
                            >
                              지우기
                            </PmButton>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Card>
          </div>
          <p className="ex-note">
            카드·계좌 자동 연동은 곧 지원돼요. 지금은 영수증 등록, 직접 입력, 발주 입고로 쌓여요.
          </p>
        </>
      )}

      {tab === "receipt" && <ReceiptPanel data={data} actions={actions} today={day} pending={pending} run={run} />}

      {tab === "orders" && (
        <Card title="발주" meta="입고 완료하면 지출에 자동으로 등록돼요" flush>
          <TableWrap>
            <table className="pm-table">
              <thead>
                <tr>
                  <th>요청일</th>
                  <th>품목</th>
                  <th className="is-num">수량</th>
                  <th>거래처</th>
                  <th className="is-num">금액</th>
                  <th>상태</th>
                  <th>
                    <span className="pm-sr">동작</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="is-muted">
                      아직 발주가 없어요. 필요한 물품을 &lsquo;발주 등록&rsquo;으로 요청해 보세요.
                    </td>
                  </tr>
                )}
                {orders.map((o) => {
                  const s = ORDER[o.status];
                  return (
                    <tr key={o.id}>
                      <td className="num">{o.date.slice(5).replace("-", ".")}</td>
                      <td>
                        <strong>{o.item}</strong>
                      </td>
                      <td className="is-num">
                        {formatNumber(o.qty)}
                        {o.unit}
                      </td>
                      <td>{o.vendor}</td>
                      <td className="is-num">{won(o.amount)}</td>
                      <td>
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </td>
                      <td className="is-num">
                        {o.status === "ordered" && (
                          <PmButton size="sm" disabled={pending} onClick={() => moveOrder(o, "received")}>
                            입고 확인
                          </PmButton>
                        )}
                        {o.status === "requested" && (
                          <PmButton size="sm" disabled={pending} onClick={() => moveOrder(o, "ordered")}>
                            발주하기
                          </PmButton>
                        )}
                        {o.status === "received" && <span className="is-muted">지출 등록됨</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}
      {dialog?.kind === "expense" && (
        <ExpenseDialog
          today={day}
          item={dialog.item}
          pending={pending}
          onClose={() => setDialog(null)}
          onSubmit={(f) => {
            const item = dialog.item;
            run(
              () => (item ? actions!.updateExpense(item.id, toInput(f)) : actions!.addExpense(toInput(f))),
              item ? `${f.vendor} 지출을 고쳤어요.` : `${f.vendor} 지출을 등록했어요.`,
              () => setDialog(null),
            );
          }}
        />
      )}
      {dialog?.kind === "delete" && (
        <Modal
          title="이 지출을 지울까요?"
          desc={`${dialog.item.vendor} ${won(dialog.item.amount)} (${dialog.item.date.replaceAll("-", ".")})`}
          onClose={() => setDialog(null)}
          footer={
            <>
              <PmButton variant="ghost" onClick={() => setDialog(null)}>
                취소
              </PmButton>
              <PmButton
                variant="navy"
                disabled={pending}
                onClick={() => {
                  const item = dialog.item;
                  run(
                    () => actions!.deleteExpense(item.id),
                    `${item.vendor} 지출을 지웠어요.`,
                    () => setDialog(null),
                  );
                }}
              >
                {pending ? "지우는 중…" : "지우기"}
              </PmButton>
            </>
          }
        >
          <p className="ex-note">지운 지출은 되돌릴 수 없어요. 월 합계와 항목별 지출에서도 빠져요.</p>
        </Modal>
      )}
      {dialog?.kind === "order" && (
        <OrderDialog
          pending={pending}
          onClose={() => setDialog(null)}
          onSubmit={(o) =>
            run(
              () => actions!.addOrder(o),
              `${o.item} 발주 요청을 등록했어요.`,
              () => setDialog(null),
            )
          }
        />
      )}
    </div>
  );
}

function ExpenseFields({
  f,
  set,
  today,
}: {
  f: Form;
  set: (k: keyof Form, v: string) => void;
  /** 날짜는 오늘까지 */
  today: string;
}) {
  return (
    <>
      <Field label="가맹점">
        <input className="pm-input" value={f.vendor} onChange={(e) => set("vendor", e.target.value)} />
      </Field>
      <div className="ex-form__row">
        <Field label="날짜">
          <input
            className="pm-input num"
            type="date"
            max={today}
            value={f.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </Field>
        <Field label="금액">
          <input
            className="pm-input num"
            inputMode="numeric"
            value={f.amount}
            onChange={(e) => set("amount", e.target.value)}
          />
        </Field>
      </div>
      <Field label="항목">
        <select className="pm-input" value={f.category} onChange={(e) => set("category", e.target.value)}>
          {(Object.keys(EXPENSE_LABEL) as ExpenseCategory[]).map((c) => (
            <option key={c} value={c}>
              {EXPENSE_LABEL[c]}
            </option>
          ))}
        </select>
      </Field>
      {f.date > today && (
        <p className="pm-error" role="alert">
          지출 날짜는 오늘까지만 넣을 수 있어요.
        </p>
      )}
    </>
  );
}

/** F6-03 영수증 사진 → 인식 결과 확인 → 지출 등록 */
function ReceiptPanel({
  data,
  actions,
  today,
  pending,
  run,
}: {
  data: ExpenseData;
  actions?: ExpenseActions;
  today: string;
  pending: boolean;
  run: (fn: () => Promise<ActionResult<unknown>>, done: string, after?: () => void) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const waiting = data.pendingReceipts ?? [];
  const [receipt, setReceipt] = useState<{ id: string | null; name: string; recognized: boolean } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const [f, setF] = useState<Form>(emptyForm(today));
  const [error, setError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const set = (k: keyof Form, v: string) => setF((x) => ({ ...x, [k]: v }));

  const pick = (file: File) => {
    setError(null);
    setPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    if (!actions) {
      const s = data.receiptSample;
      setReceipt({ id: null, name: file.name, recognized: true });
      setF({ vendor: s.vendor, date: s.date, amount: formatNumber(s.amount), category: s.category });
      return;
    }
    startUpload(async () => {
      const form = new FormData();
      form.append("file", file);
      const r = await actions.uploadReceipt(form);
      if (!r.ok) return setError(r.message);
      setReceipt({ id: r.data.id, name: file.name, recognized: Boolean(r.data.vendor || r.data.amount) });
      setF({
        vendor: r.data.vendor ?? "",
        date: r.data.date ?? today,
        amount: r.data.amount ? formatNumber(r.data.amount) : "",
        category: r.data.category ?? "amenity",
      });
    });
  };

  const resume = (r: NonNullable<ExpenseData["pendingReceipts"]>[number]) => {
    setPreview(null);
    setReceipt({ id: r.id, name: r.fileName, recognized: Boolean(r.vendor || r.amount) });
    setF({
      vendor: r.vendor ?? "",
      date: r.date ?? today,
      amount: r.amount ? formatNumber(r.amount) : "",
      category: r.category ?? "amenity",
    });
  };

  const reset = () => {
    setReceipt(null);
    setPreview(null);
    setF(emptyForm(today));
    if (input.current) input.current.value = "";
  };

  return (
    <div className="ex-receipt">
      <Card title="1. 영수증 사진">
        <input
          ref={input}
          type="file"
          accept="image/*,application/pdf"
          hidden
          onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
        />
        <button
          type="button"
          className={cx("ex-drop", receipt && (receipt.recognized ? "is-done" : "is-miss"))}
          disabled={uploading}
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) pick(file);
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- 방금 고른 파일의 미리보기 (blob 주소)
            <img src={preview} alt="올린 영수증 미리보기" className="ex-drop__preview" />
          ) : (
            <Icon name={receipt ? (receipt.recognized ? "check" : "alert") : "photo"} size={28} swap />
          )}
          <strong>
            {uploading
              ? "읽는 중…"
              : receipt
                ? receipt.recognized
                  ? `${receipt.name} 인식 완료`
                  : "인식하지 못했어요 — 직접 입력해 주세요"
                : "사진을 끌어다 놓거나 눌러서 고르세요"}
          </strong>
          <span>
            {receipt
              ? receipt.recognized
                ? "옆 내용을 확인하고 등록해 주세요. 누르면 다른 사진으로 바꿔요."
                : `${receipt.name} — 옆 칸을 채우면 등록할 수 있어요`
              : "휴대폰에서는 촬영하거나 앨범에서 고를 수 있어요. JPG, PNG, PDF (10MB까지)"}
          </span>
        </button>
        {error && (
          <p className="pm-error" role="alert">
            {error}
          </p>
        )}
        {waiting.length > 0 && (
          <div className="ex-wait">
            <p>등록을 기다리는 영수증 {waiting.length}장</p>
            <ul>
              {waiting.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => resume(r)}>
                    {r.fileName}
                    {r.amount ? `  ${won(r.amount)}` : ""}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      <Card
        title="2. 인식 결과 확인"
        meta={
          receipt
            ? receipt.recognized
              ? "읽은 결과예요 — 틀리거나 빈 곳만 고쳐 주세요"
              : "읽은 내용이 없어요 — 영수증을 보고 채워 주세요"
            : "사진을 올리면 채워져요"
        }
      >
        <fieldset className="ex-form" disabled={!receipt}>
          <ExpenseFields f={f} set={set} today={today} />
        </fieldset>
        <div className="ex-form__actions">
          <PmButton variant="ghost" onClick={reset} disabled={!receipt}>
            다시 올리기
          </PmButton>
          <PmButton
            variant="primary"
            icon="check"
            disabled={!receipt || pending || !filled(f, today)}
            onClick={() =>
              run(
                () => actions!.registerReceipt(receipt!.id!, toInput(f)),
                `${f.vendor} ${formatNumber(toInput(f).amount)}원을 지출로 등록했어요.`,
                reset,
              )
            }
          >
            지출로 등록
          </PmButton>
        </div>
      </Card>
    </div>
  );
}

function ExpenseDialog({
  today,
  item,
  pending,
  onClose,
  onSubmit,
}: {
  today: string;
  /** 있으면 고치기 */
  item?: ExpenseItem;
  pending: boolean;
  onClose: () => void;
  onSubmit: (f: Form) => void;
}) {
  const [f, setF] = useState<Form>(item ? fromItem(item) : emptyForm(today));
  return (
    <Modal
      title={item ? "지출 고치기" : "지출 직접 입력"}
      onClose={onClose}
      footer={
        <>
          <PmButton variant="ghost" onClick={onClose}>
            취소
          </PmButton>
          <PmButton variant="primary" disabled={pending || !filled(f, today)} onClick={() => onSubmit(f)}>
            {pending ? "저장 중…" : item ? "변경 저장" : "등록"}
          </PmButton>
        </>
      }
    >
      <ExpenseFields f={f} set={(k, v) => setF((x) => ({ ...x, [k]: v }))} today={today} />
    </Modal>
  );
}

function OrderDialog({
  pending,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  onClose: () => void;
  onSubmit: (o: { item: string; qty: number; unit: string; vendor: string; amount: number }) => void;
}) {
  const [f, setF] = useState({ item: "", qty: "1", unit: "박스", vendor: "", amount: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));
  const num = (v: string) => Number(v.replace(/\D/g, ""));
  const ok = f.item.trim() && f.vendor.trim() && num(f.qty) > 0 && f.unit.trim();
  return (
    <Modal
      title="발주 등록"
      desc="입고를 확인하면 지출에 자동으로 등록돼요."
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
              onSubmit({
                item: f.item.trim(),
                qty: num(f.qty),
                unit: f.unit.trim(),
                vendor: f.vendor.trim(),
                amount: num(f.amount),
              })
            }
          >
            {pending ? "저장 중…" : "등록"}
          </PmButton>
        </>
      }
    >
      <Field label="품목">
        <input className="pm-input" placeholder="예: 일회용 칫솔 세트" value={f.item} onChange={set("item")} />
      </Field>
      <div className="ex-form__row">
        <Field label="수량">
          <input className="pm-input num" inputMode="numeric" value={f.qty} onChange={set("qty")} />
        </Field>
        <Field label="단위">
          <input className="pm-input" value={f.unit} onChange={set("unit")} />
        </Field>
      </div>
      <Field label="거래처">
        <input className="pm-input" value={f.vendor} onChange={set("vendor")} />
      </Field>
      <Field label="금액 (예상)">
        <input className="pm-input num" inputMode="numeric" value={f.amount} onChange={set("amount")} />
      </Field>
    </Modal>
  );
}
