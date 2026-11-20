import { Logo } from "@/ui/brand";
import "./auth.css";

/** 앱 첫 화면에서 실제로 보게 될 "지금 처리할 일" 몇 줄 — 이미지가 아니라 CSS 로 그린 예시 */
const SAMPLE = [
  { tone: "bad", kind: "연동 끊김", place: "을지로점", what: "여기어때 다시 로그인" },
  { tone: "warn", kind: "낮은 별점", place: "명동점", what: "★2 리뷰 답글 초안 준비됨" },
  { tone: "warn", kind: "청소 지연", place: "성수점", what: "206호 2시간 넘음" },
] as const;

/**
 * 로그인·가입·초대 화면 왼쪽 남색 면 (D-26).
 * 기능 목록(✓ ✓ ✓) 대신 들어가면 바로 보게 될 화면 한 조각을 보여 준다. 휴대폰에서는 로고 한 줄만.
 */
export function AuthBrand() {
  return (
    <aside className="au-brand">
      <Logo tone="footer" className="au-brand__logo" />
      <div className="au-brand__body">
        <h1 className="au-brand__title">
          업장 여러 곳,
          <br />
          아침에 한 화면으로.
        </h1>
        <div className="au-peek" aria-hidden>
          <p className="au-peek__head">
            <span>지금 처리할 일</span>
            <b className="num">3건</b>
          </p>
          <ul>
            {SAMPLE.map((x) => (
              <li key={x.kind} className={`is-${x.tone}`}>
                <span className="au-peek__kind">{x.kind}</span>
                <span className="au-peek__place">{x.place}</span>
                <span className="au-peek__what">{x.what}</span>
              </li>
            ))}
          </ul>
          <p className="au-peek__pay">
            <span>다음 입금</span>
            <b className="num">11.21 (토)</b>
            <b className="num">310만 원</b>
          </p>
        </div>
      </div>
      <p className="au-brand__foot">채널 연결은 쓰던 파트너센터 아이디로. 첫 달은 무료예요.</p>
    </aside>
  );
}
