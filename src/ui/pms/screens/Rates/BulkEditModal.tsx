"use client";

import { useState } from "react";
import type { RateGrid } from "@/core";
import { cx, formatShortDate, weekday } from "@/shared";
import { Modal, PmButton } from "../../components";

export interface BulkEdit {
  planIds: string[];
  from: string;
  to: string;
  /** 0 = 일 … 6 = 토 */
  weekdays: number[];
  stock?: number;
  price?: number;
  open?: boolean;
}

interface BulkEditModalProps {
  grid: RateGrid;
  minPrice: number;
  onClose: () => void;
  onApply: (bulk: BulkEdit) => void;
}

const DAYS = [
  { n: 1, label: "월" },
  { n: 2, label: "화" },
  { n: 3, label: "수" },
  { n: 4, label: "목" },
  { n: 5, label: "금" },
  { n: 6, label: "토" },
  { n: 0, label: "일" },
];
const PRESETS = [
  { label: "매일", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "일–목", days: [0, 1, 2, 3, 4] },
  { label: "금–토", days: [5, 6] },
];

const toNumber = (raw: string) => {
  const digits = raw.replace(/[^\d]/g, "");
  return digits === "" ? undefined : Number(digits);
};

export function BulkEditModal({ grid, minPrice, onClose, onApply }: BulkEditModalProps) {
  const basePlans = grid.roomTypes.flatMap((r) =>
    r.plans.filter((p) => !p.derived).map((p) => ({ id: p.id, label: `${r.name} › ${p.name}` })),
  );
  const [planIds, setPlanIds] = useState<string[]>(basePlans.map((p) => p.id));
  const [from, setFrom] = useState(grid.dates[0]);
  const [to, setTo] = useState(grid.dates[grid.dates.length - 1]);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [stock, setStock] = useState("");
  const [price, setPrice] = useState("");
  const [open, setOpen] = useState<"keep" | "open" | "closed">("keep");

  const dateCount = grid.dates.filter((d) => d >= from && d <= to && days.includes(weekday(d))).length;
  const stockN = toNumber(stock);
  const priceN = toNumber(price);
  const priceInvalid = priceN !== undefined && priceN < minPrice;
  const nothing = stockN === undefined && priceN === undefined && open === "keep";
  const cells = planIds.length * dateCount;

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <Modal
      title="기간 일괄 변경"
      desc="고른 기간·요일의 칸을 한꺼번에 바꿔요. 저장 전에 그리드에서 다시 확인할 수 있어요."
      onClose={onClose}
      footer={
        <>
          <span className="rt-bulk__preview num">{nothing ? "바꿀 값을 넣어 주세요" : `${cells}칸에 적용합니다`}</span>
          <PmButton variant="ghost" onClick={onClose}>
            취소
          </PmButton>
          <PmButton
            variant="navy"
            disabled={nothing || cells === 0 || priceInvalid}
            onClick={() =>
              onApply({
                planIds,
                from,
                to,
                weekdays: days,
                stock: stockN,
                price: priceN,
                open: open === "keep" ? undefined : open === "open",
              })
            }
          >
            그리드에 반영
          </PmButton>
        </>
      }
    >
      <div className="rt-bulk">
        <fieldset className="rt-bulk__field">
          <legend>기간</legend>
          <div className="rt-bulk__range">
            <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="시작일">
              {grid.dates.map((d) => (
                <option key={d} value={d}>
                  {formatShortDate(d)}
                </option>
              ))}
            </select>
            <span>~</span>
            <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="종료일">
              {grid.dates
                .filter((d) => d >= from)
                .map((d) => (
                  <option key={d} value={d}>
                    {formatShortDate(d)}
                  </option>
                ))}
            </select>
          </div>
          <div className="rt-bulk__days">
            {DAYS.map((d) => (
              <button
                key={d.n}
                type="button"
                className={cx(
                  "rt-bulk__day",
                  days.includes(d.n) && "is-on",
                  d.n === 6 && "is-sat",
                  d.n === 0 && "is-sun",
                )}
                aria-pressed={days.includes(d.n)}
                onClick={() => setDays(toggle(days, d.n))}
              >
                {d.label}
              </button>
            ))}
            <span className="rt-bulk__presets">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => setDays(p.days)}>
                  {p.label}
                </button>
              ))}
            </span>
          </div>
        </fieldset>

        <fieldset className="rt-bulk__field">
          <legend>요금제</legend>
          <div className="rt-bulk__plans">
            {basePlans.map((p) => (
              <label key={p.id} className="rt-bulk__check">
                <input
                  type="checkbox"
                  checked={planIds.includes(p.id)}
                  onChange={() => setPlanIds(toggle(planIds, p.id))}
                />
                {p.label}
              </label>
            ))}
          </div>
          <p className="rt-bulk__hint">자동 계산 요금제는 기준 요금제를 따라 함께 바뀌어요.</p>
        </fieldset>

        <fieldset className="rt-bulk__field rt-bulk__values">
          <legend>바꿀 값 (비워 두면 그대로)</legend>
          <label>
            <span>재고</span>
            <input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="그대로" />
          </label>
          <label>
            <span>요금</span>
            <input
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="그대로"
              aria-invalid={priceInvalid || undefined}
            />
          </label>
          <label>
            <span>판매상태</span>
            <select value={open} onChange={(e) => setOpen(e.target.value as typeof open)}>
              <option value="keep">그대로</option>
              <option value="open">판매</option>
              <option value="closed">마감</option>
            </select>
          </label>
        </fieldset>
      </div>
    </Modal>
  );
}
