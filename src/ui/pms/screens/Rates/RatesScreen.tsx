"use client";

import { Fragment, useMemo, useState } from "react";
import {
  derivePrice,
  describeRule,
  diffRateGrid,
  type RateCell,
  type RateChange,
  type RateGrid,
  type RatePlan,
} from "@/core";
import { cx, formatNumber, formatShortDate, weekday, weekdayKo } from "@/shared";
import { Icon, PageHead, PmButton } from "../../components";
import { BulkEditModal, type BulkEdit } from "./BulkEditModal";
import { ConfirmModal } from "./ConfirmModal";
import "./rates.css";

type Cells = Record<string, RateCell[]>;

const MIN_PRICE = 1000;

const clone = (cells: RateGrid["cells"]): Cells =>
  Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, v.map((c) => ({ ...c }))]));

/** 입력 문자열 → 숫자. 빈칸이면 null (미입력) */
const parseNumber = (raw: string): number | null => {
  const digits = raw.replace(/[^\d]/g, "");
  return digits === "" ? null : Number(digits);
};

interface RatesScreenProps {
  grid: RateGrid;
  /** 오늘 "YYYY-MM-DD" (없으면 첫 날짜) */
  today?: string;
  /** 채널 요금 연동 전 — 화면만 보여 주고 고치거나 저장할 수 없다 */
  readOnly?: boolean;
}

export function RatesScreen({ grid, today, readOnly = false }: RatesScreenProps) {
  const [saved, setSaved] = useState<Cells>(() => clone(grid.cells));
  const [edited, setEdited] = useState<Cells>(() => clone(grid.cells));
  const [showStock, setShowStock] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const baseline: RateGrid = useMemo(() => ({ ...grid, cells: saved }), [grid, saved]);
  const changes = useMemo(() => diffRateGrid(baseline, edited), [baseline, edited]);
  const changedKeys = useMemo(() => new Set(changes.map((c) => `${c.planId}|${c.date}|${c.field}`)), [changes]);
  const errors = useMemo(() => {
    let n = 0;
    for (const room of grid.roomTypes)
      for (const plan of room.plans)
        if (!plan.derived)
          for (const cell of edited[plan.id]) if (cell.price !== null && cell.price < MIN_PRICE) n += 1;
    return n;
  }, [grid.roomTypes, edited]);

  const planById = useMemo(() => {
    const map: Record<string, RatePlan> = {};
    for (const room of grid.roomTypes) for (const plan of room.plans) map[plan.id] = plan;
    return map;
  }, [grid.roomTypes]);

  const update = (planId: string, index: number, patch: Partial<RateCell>) =>
    setEdited((prev) => ({
      ...prev,
      [planId]: prev[planId].map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));

  const applyBulk = (bulk: BulkEdit) => {
    setEdited((prev) => {
      const next = { ...prev };
      for (const planId of bulk.planIds) {
        next[planId] = prev[planId].map((cell, i) => {
          const date = grid.dates[i];
          if (date < bulk.from || date > bulk.to || !bulk.weekdays.includes(weekday(date))) return cell;
          return {
            stock: bulk.stock ?? cell.stock,
            price: bulk.price ?? cell.price,
            open: bulk.open ?? cell.open,
          };
        });
      }
      return next;
    });
    setBulkOpen(false);
  };

  const save = () => {
    setSaved(clone(edited));
    setConfirmOpen(false);
    setToast(`${changes.length}건을 저장하고 연동 채널로 보냈어요.`);
    window.setTimeout(() => setToast(null), 3200);
  };

  const isChanged = (planId: string, date: string, field: RateChange["field"]) =>
    changedKeys.has(`${planId}|${date}|${field}`);

  const todayIso = today ?? grid.dates[0];
  const first = grid.dates[0];
  const last = grid.dates[grid.dates.length - 1];

  return (
    <div className="rt">
      <PageHead
        title="요금·재고"
        desc={
          readOnly
            ? "날짜별 요금과 남은 방을 한눈에 봐요. 채널 요금 연동이 끝나면 여기서 고쳐서 채널로 보낼 수 있어요."
            : "날짜별 요금과 남은 방을 고치고 한 번에 저장하면 연동된 채널로 보내요."
        }
        actions={
          <PmButton
            icon="calendar"
            onClick={() => setBulkOpen(true)}
            disabled={readOnly}
            title={readOnly ? "채널 요금 연동 후 사용할 수 있어요" : undefined}
          >
            기간 일괄 변경
          </PmButton>
        }
      />
      {readOnly && (
        <div className="rt-banner" role="note">
          <Icon name="lock" size={16} />
          <p>
            <strong>채널 연동 후 사용할 수 있어요</strong>
            지금 보이는 요금·재고는 예시 값이에요. 채널 요금 연동이 열리면 여기서 고친 값을 채널로 바로 보낼 수 있어요.
          </p>
        </div>
      )}

      <div className="rt-toolbar">
        <div className="rt-range">
          <button type="button" className="rt-range__btn" aria-label="이전 기간" disabled>
            <Icon name="chevronLeft" size={16} />
          </button>
          <span className="rt-range__label num">
            {formatShortDate(first)} – {formatShortDate(last)}
          </span>
          <button type="button" className="rt-range__btn" aria-label="다음 기간" disabled>
            <Icon name="chevron" size={16} />
          </button>
        </div>
        {/* 보기 — 세그먼트 하나 (둘 다 / 재고만 / 요금만), 고른 것은 남색 (D-20) */}
        <div className="pm-seg rt-view" role="group" aria-label="보이는 줄">
          {(
            [
              ["both", "재고와 요금", true, true],
              ["stock", "재고만", true, false],
              ["price", "요금만", false, true],
            ] as const
          ).map(([key, label, st, pr]) => (
            <button
              key={key}
              type="button"
              className="pm-seg__btn"
              aria-pressed={showStock === st && showPrice === pr}
              onClick={() => {
                setShowStock(st);
                setShowPrice(pr);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <ul className="rt-legend" aria-label="칸 표시 설명">
          <li>
            <i className="rt-legend__dirty" /> 저장 전 고친 칸
          </li>
          <li>
            <i className="rt-legend__closed" /> 판매 마감
          </li>
          <li>
            <i className="rt-legend__empty" /> 미입력
          </li>
          <li>
            <Icon name="derived" size={14} /> 자동 계산
          </li>
        </ul>
      </div>

      <fieldset className="rt-scroller" disabled={readOnly} aria-label="요금·재고 표">
        <table className="rt-grid">
          <thead>
            <tr>
              <th className="rt-grid__corner" scope="col">
                객실과 요금제
              </th>
              {grid.dates.map((date) => {
                const d = weekday(date);
                return (
                  <th
                    key={date}
                    scope="col"
                    className={cx(
                      "rt-grid__date",
                      d === 6 && "is-sat",
                      d === 0 && "is-sun",
                      date === todayIso && "is-today",
                    )}
                  >
                    <span className="rt-grid__dow">{date === todayIso ? "오늘" : weekdayKo(date)}</span>
                    <span className="rt-grid__day num">
                      {Number(date.slice(5, 7))}.{Number(date.slice(8))}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {grid.roomTypes.map((room) => {
              const basePlans = room.plans.filter((p) => !p.derived);
              return (
                <Fragment key={room.id}>
                  <tr className="rt-room">
                    <th scope="rowgroup" className="rt-room__name">
                      {room.name}
                      <small>판매 가능</small>
                    </th>
                    {grid.dates.map((date, i) => {
                      const sellable = basePlans.reduce((sum, p) => {
                        const c = edited[p.id][i];
                        return sum + (c.open && c.price ? (c.stock ?? 0) : 0);
                      }, 0);
                      return (
                        <td key={date} className={cx("rt-room__sum num", sellable === 0 && "is-zero")}>
                          {sellable}
                        </td>
                      );
                    })}
                  </tr>

                  {room.plans.map((plan) =>
                    plan.derived ? (
                      <tr key={plan.id} className="rt-row rt-row--derived">
                        <th scope="row" className="rt-label">
                          <span className="rt-label__plan">
                            <Icon name="derived" size={14} />
                            {plan.name}
                            {plan.meal && <em>{plan.meal}</em>}
                          </span>
                          <small>{describeRule(plan.derived, planById[plan.derived.from].name)}</small>
                        </th>
                        {grid.dates.map((date, i) => {
                          const base = edited[plan.derived!.from][i];
                          const price = derivePrice(base.price, plan.derived!);
                          const changed = isChanged(plan.derived!.from, date, "price");
                          return (
                            <td
                              key={date}
                              className={cx(
                                "rt-cell rt-cell--auto num",
                                !base.open && "is-closed",
                                changed && "is-follow",
                              )}
                            >
                              {price === null ? "–" : formatNumber(price)}
                            </td>
                          );
                        })}
                      </tr>
                    ) : (
                      <Fragment key={plan.id}>
                        <tr className="rt-row rt-row--plan">
                          <th scope="row" className="rt-label">
                            <span className="rt-label__plan">{plan.name}</span>
                            <small>판매</small>
                          </th>
                          {grid.dates.map((date, i) => {
                            const cell = edited[plan.id][i];
                            return (
                              <td key={date} className="rt-cell rt-cell--toggle">
                                <button
                                  type="button"
                                  className={cx(
                                    "rt-switch",
                                    cell.open ? "is-open" : "is-closed",
                                    isChanged(plan.id, date, "open") && "is-dirty",
                                  )}
                                  aria-pressed={cell.open}
                                  aria-label={`${room.name} ${plan.name} ${formatShortDate(date)} ${cell.open ? "판매중" : "마감"}`}
                                  onClick={() => update(plan.id, i, { open: !cell.open })}
                                >
                                  {cell.open ? "판매" : "마감"}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                        {showStock && (
                          <tr className="rt-row">
                            <th scope="row" className="rt-label rt-label--field">
                              재고
                            </th>
                            {grid.dates.map((date, i) => {
                              const cell = edited[plan.id][i];
                              return (
                                <td
                                  key={date}
                                  className={cx(
                                    "rt-cell",
                                    !cell.open && "is-closed",
                                    isChanged(plan.id, date, "stock") && "is-dirty",
                                  )}
                                >
                                  <input
                                    className={cx("rt-input num", cell.stock === 0 && "is-zero")}
                                    inputMode="numeric"
                                    value={cell.stock ?? ""}
                                    placeholder="–"
                                    aria-label={`${room.name} ${plan.name} ${formatShortDate(date)} 재고`}
                                    onChange={(e) => update(plan.id, i, { stock: parseNumber(e.target.value) })}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        )}
                        {showPrice && (
                          <tr className="rt-row">
                            <th scope="row" className="rt-label rt-label--field">
                              요금
                            </th>
                            {grid.dates.map((date, i) => {
                              const cell = edited[plan.id][i];
                              const invalid = cell.price !== null && cell.price < MIN_PRICE;
                              return (
                                <td
                                  key={date}
                                  className={cx(
                                    "rt-cell",
                                    !cell.open && "is-closed",
                                    isChanged(plan.id, date, "price") && "is-dirty",
                                    invalid && "is-invalid",
                                  )}
                                >
                                  <input
                                    className="rt-input rt-input--price num"
                                    inputMode="numeric"
                                    value={cell.price === null ? "" : formatNumber(cell.price)}
                                    placeholder="–"
                                    aria-label={`${room.name} ${plan.name} ${formatShortDate(date)} 요금`}
                                    aria-invalid={invalid || undefined}
                                    title={invalid ? `요금은 ${formatNumber(MIN_PRICE)}원 이상이어야 해요` : undefined}
                                    onChange={(e) => update(plan.id, i, { price: parseNumber(e.target.value) })}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        )}
                      </Fragment>
                    ),
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </fieldset>
      <p className="rt-note">
        빈칸은 &lsquo;미입력&rsquo;으로 저장되어 채널에서 판매되지 않아요. 자동 계산 요금제는 기준 요금제의 재고와 판매
        상태를 함께 써요.
      </p>

      {!readOnly && (changes.length > 0 || errors > 0) && (
        <div className="rt-savebar" role="region" aria-label="저장">
          <p>
            <span>
              <strong className="num">{changes.length}</strong>건 고침
            </span>
            {errors > 0 && (
              <span className="rt-savebar__err">
                <Icon name="alert" size={14} /> 요금 확인 필요 <span className="num">{errors}</span>칸
              </span>
            )}
          </p>
          <PmButton variant="quiet" icon="undo" onClick={() => setEdited(clone(saved))}>
            모두 되돌리기
          </PmButton>
          <PmButton
            variant="primary"
            onClick={() => setConfirmOpen(true)}
            disabled={errors > 0 || changes.length === 0}
          >
            변경 내용 확인
          </PmButton>
        </div>
      )}

      {bulkOpen && (
        <BulkEditModal grid={grid} onClose={() => setBulkOpen(false)} onApply={applyBulk} minPrice={MIN_PRICE} />
      )}
      {confirmOpen && (
        <ConfirmModal
          grid={grid}
          changes={changes}
          planById={planById}
          edited={edited}
          onClose={() => setConfirmOpen(false)}
          onSave={save}
        />
      )}
      {toast && (
        <div className="rt-toast" role="status">
          <Icon name="check" size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
