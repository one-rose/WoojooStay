/**
 * 화면을 불러오는 동안 — 화면 머리 · 요약 띠 · 줄 몇 개 모양으로 자리를 잡아 둔다 (D-25).
 * 실제 화면 배치와 비슷하게 그려서, 데이터가 들어올 때 본문이 크게 밀리지 않게.
 * strip: 요약 띠 칸 수 (0 이면 띠 없음) · rows: 아래 패널 줄 수
 */
export function ScreenSkeleton({ strip = 4, rows = 3 }: { strip?: 0 | 2 | 3 | 4; rows?: number }) {
  return (
    <div className="pm-skel" aria-busy="true" aria-label="불러오는 중" role="status">
      <div className="pm-skel__head">
        <span className="pm-skel__bar" style={{ width: 180, height: 26 }} />
        <span className="pm-skel__bar" style={{ width: "min(360px, 80%)", height: 14 }} />
      </div>
      {strip > 0 && (
        <div className="pm-skel__strip" style={{ "--cols": strip } as React.CSSProperties}>
          {Array.from({ length: strip }, (_, i) => (
            <div key={i}>
              <span className="pm-skel__bar" style={{ width: 90, height: 12 }} />
              <span className="pm-skel__bar" style={{ width: "70%", height: 28 }} />
              <span className="pm-skel__bar" style={{ width: 110, height: 11 }} />
            </div>
          ))}
        </div>
      )}
      <div className="pm-skel__panel">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="pm-skel__row">
            <span className="pm-skel__bar" style={{ height: 14 }} />
            <span className="pm-skel__bar" style={{ height: 12, width: `${80 - i * 15}%` }} />
            <span className="pm-skel__bar" style={{ height: 28 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
