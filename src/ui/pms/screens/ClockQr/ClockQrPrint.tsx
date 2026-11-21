"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult, ClockQrData } from "@/core";
import { qrSvgPath } from "@/shared";
import { Modal, PmButton } from "../../components";
import "./clock-qr.css";

interface ClockQrPrintProps {
  data: ClockQrData;
  /** 사장님만 — QR 새로 만들기. 없으면 버튼 없음 (매니저 · 체험 모드) */
  rotate?: () => Promise<ActionResult<unknown>>;
  /** 체험 모드 — 예시 QR 이라 찍어도 출근되지 않는다 */
  demo?: boolean;
}

/**
 * 출근 QR 인쇄 (A4 한 장) — 프런트에 붙여 두면 위치가 안 잡히는 직원이 앱으로 찍어 출퇴근한다.
 * 고정 QR (시간마다 바뀌지 않음). 새로 만들면 예전에 인쇄한 종이는 더 이상 안 된다.
 */
export function ClockQrPrint({ data, rotate, demo }: ClockQrPrintProps) {
  const router = useRouter();
  const qr = useMemo(() => qrSvgPath(data.payload), [data.payload]);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const doRotate = () =>
    start(async () => {
      const r = await rotate!();
      setConfirm(false);
      if (!r.ok) return setNote({ bad: true, text: r.message });
      setNote({ bad: false, text: "새 QR을 만들었어요. 예전에 붙인 종이를 떼고 새로 인쇄해 붙여 주세요." });
      router.refresh();
    });

  return (
    <div className="cq">
      <div className="cq-bar">
        <PmButton variant="quiet" icon="chevronLeft" href="/app/settings/property">
          설정으로
        </PmButton>
        <div className="cq-bar__right">
          {rotate && (
            <PmButton variant="quiet" icon="sync" onClick={() => setConfirm(true)}>
              QR 새로 만들기
            </PmButton>
          )}
          <PmButton variant="primary" onClick={() => window.print()}>
            인쇄하기
          </PmButton>
        </div>
      </div>
      {note && (
        <p className={note.bad ? "cq-note is-bad" : "cq-note"} role={note.bad ? "alert" : "status"}>
          {note.text}
        </p>
      )}
      {demo && <p className="cq-note">체험 모드의 예시 QR이에요. 찍어도 출근되지 않아요.</p>}

      <article className="cq-sheet" aria-label="출근 QR 인쇄 미리보기">
        <header className="cq-sheet__head">
          <p className="cq-sheet__brand">우주스테이</p>
          <h1 className="cq-sheet__name">{data.propertyName}</h1>
          <p className="cq-sheet__title">출퇴근 QR</p>
        </header>
        <svg
          className="cq-sheet__qr"
          viewBox={`0 0 ${qr.size} ${qr.size}`}
          role="img"
          aria-label={`${data.propertyName} 출퇴근 QR`}
          shapeRendering="crispEdges"
        >
          <rect width={qr.size} height={qr.size} fill="#fff" />
          <path d={qr.path} fill="#000" />
        </svg>
        <ol className="cq-sheet__steps">
          <li>우주스테이 앱에서 출근이나 퇴근을 눌러요.</li>
          <li>위치가 잡히지 않으면 QR 찍기를 누르고 이 QR을 비춰요.</li>
          <li>그래도 안 되면 사유를 적어 요청을 보내 주세요. 사장님이나 매니저가 확인해요.</li>
        </ol>
        <footer className="cq-sheet__foot">
          이 QR은 {data.propertyName} 전용이에요. 떼어 가거나 사진으로 찍어 쓰지 말아 주세요. (QR 번호 {data.keyVersion}
          )
        </footer>
      </article>

      {confirm && (
        <Modal
          title="출근 QR을 새로 만들까요?"
          desc="지금 붙어 있는 QR은 바로 쓸 수 없게 돼요. 새 QR을 인쇄해 같은 자리에 붙여 주세요."
          onClose={() => setConfirm(false)}
          footer={
            <>
              <PmButton variant="ghost" onClick={() => setConfirm(false)}>
                취소
              </PmButton>
              <PmButton variant="alert" disabled={pending} onClick={doRotate}>
                {pending ? "만드는 중…" : "새로 만들기"}
              </PmButton>
            </>
          }
        >
          <p className="cq-modal__text">QR 사진이 밖으로 퍼졌거나 종이를 잃어버렸을 때 쓰세요.</p>
        </Modal>
      )}
    </div>
  );
}
