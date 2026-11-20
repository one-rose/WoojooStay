"use client";

import { derivePrice, type RateCell, type RateChange, type RateGrid, type RatePlan } from "@/core";
import { formatShortDate, formatWon } from "@/shared";
import { Badge, Icon, Modal, PmButton } from "../../components";

interface ConfirmModalProps {
  grid: RateGrid;
  changes: readonly RateChange[];
  planById: Record<string, RatePlan>;
  edited: Record<string, RateCell[]>;
  onClose: () => void;
  onSave: () => void;
}

const FIELD_LABEL: Record<RateChange["field"], string> = { stock: "재고", price: "요금", open: "판매상태" };

function show(field: RateChange["field"], value: RateChange["before"]) {
  if (field === "open") return value ? "판매" : "마감";
  if (value === null) return <span className="rt-confirm__empty">미입력</span>;
  return field === "price" ? `${formatWon(value as number)}` : `${value}실`;
}

export function ConfirmModal({ grid, changes, planById, edited, onClose, onSave }: ConfirmModalProps) {
  const derivedOf = (planId: string) =>
    grid.roomTypes.flatMap((r) => r.plans).filter((p) => p.derived?.from === planId);
  const openChanges = changes.filter((c) => c.field === "open").length;
  const dates = [...new Set(changes.map((c) => c.date))].sort();

  return (
    <Modal
      title="변경 내용 확인"
      desc={
        <>
          아래 <strong>{changes.length}건</strong>을 저장하고 연동된 채널로 보내요.{" "}
          {openChanges > 0 && <Badge tone="warn">판매상태 변경 {openChanges}건 포함</Badge>}
        </>
      }
      onClose={onClose}
      wide
      footer={
        <>
          <PmButton variant="ghost" onClick={onClose}>
            더 고치기
          </PmButton>
          <PmButton variant="primary" icon="check" onClick={onSave}>
            저장하고 채널에 보내기
          </PmButton>
        </>
      }
    >
      <table className="rt-confirm">
        <thead>
          <tr>
            <th scope="col">날짜</th>
            <th scope="col">객실과 요금제</th>
            <th scope="col">항목</th>
            <th scope="col">변경</th>
          </tr>
        </thead>
        <tbody>
          {dates.map((date) =>
            changes
              .filter((c) => c.date === date)
              .map((c, i, arr) => {
                const index = grid.dates.indexOf(date);
                const followers = c.field === "price" ? derivedOf(c.planId) : [];
                return (
                  <tr key={`${c.planId}-${c.field}`} className={i === arr.length - 1 ? "is-last" : undefined}>
                    {i === 0 && (
                      <th scope="rowgroup" rowSpan={arr.length} className="rt-confirm__date num">
                        {formatShortDate(date)}
                      </th>
                    )}
                    <td>
                      {c.roomType} › {c.plan}
                    </td>
                    <td>
                      <span className={c.field === "open" ? "rt-confirm__field is-open" : "rt-confirm__field"}>
                        {FIELD_LABEL[c.field]}
                      </span>
                    </td>
                    <td className="num">
                      <span className="rt-confirm__before">{show(c.field, c.before)}</span>
                      <Icon name="chevron" size={13} className="rt-confirm__arrow" />
                      <strong>{show(c.field, c.after)}</strong>
                      {followers.map((p) => {
                        const before = derivePrice(c.before as number | null, p.derived!);
                        const after = derivePrice(edited[c.planId][index].price, p.derived!);
                        return (
                          <span key={p.id} className="rt-confirm__follow">
                            <Icon name="derived" size={12} /> {planById[p.id].name}{" "}
                            {before === null ? "미입력" : `${formatWon(before)}`} →{" "}
                            {after === null ? "미입력" : `${formatWon(after)}`}
                          </span>
                        );
                      })}
                    </td>
                  </tr>
                );
              }),
          )}
        </tbody>
      </table>
    </Modal>
  );
}
