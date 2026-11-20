import { Modal } from "../Modal/Modal";
import { PmButton } from "../PmButton/PmButton";
import "./apply-to.css";

/** 다른 업장 고르기 — 답글 설정·알림 설정 "다른 업장에도 적용" */
export function ApplyToDialog({
  title,
  desc,
  properties,
  selected,
  onChange,
  pending,
  onClose,
  onApply,
}: {
  title: string;
  desc: string;
  properties: readonly { id: string; name: string }[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  pending?: boolean;
  onClose: () => void;
  onApply: () => void;
}) {
  const all = selected.length === properties.length;
  return (
    <Modal
      title={title}
      desc={desc}
      onClose={onClose}
      footer={
        <>
          <PmButton variant="ghost" onClick={onClose}>
            취소
          </PmButton>
          <PmButton variant="primary" disabled={pending || selected.length === 0} onClick={onApply}>
            {selected.length}곳에 적용
          </PmButton>
        </>
      }
    >
      <div className="pm-apply__list" role="group" aria-label="적용할 업장">
        <label className="pm-apply__all">
          <input type="checkbox" checked={all} onChange={() => onChange(all ? [] : properties.map((p) => p.id))} />
          모두 고르기
        </label>
        {properties.map((p) => (
          <label key={p.id}>
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() =>
                onChange(selected.includes(p.id) ? selected.filter((x) => x !== p.id) : [...selected, p.id])
              }
            />
            {p.name}
          </label>
        ))}
      </div>
    </Modal>
  );
}
