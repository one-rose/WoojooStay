import { Logo } from "@/ui/brand";
import { Icon } from "../../components";
import "./auth.css";

/** 로그인·가입·초대 화면 왼쪽 남색 브랜드 면 */
export function AuthBrand() {
  return (
    <aside className="au-brand">
      <Logo tone="footer" className="au-brand__logo" />
      <div>
        <h1 className="au-brand__title">
          고객 리뷰에서 시작해,
          <br />
          숙박업의 모든 경영을
          <br />한 궤도에.
        </h1>
      </div>
      <ul className="au-brand__list">
        <li>
          <Icon name="check" size={16} /> 쓰던 예약 채널 계정을 그대로 연결
        </li>
        <li>
          <Icon name="check" size={16} /> 리뷰마다 답글 초안을 미리 작성
        </li>
        <li>
          <Icon name="check" size={16} /> 첫 달 무료, 필요한 서비스만 구독
        </li>
      </ul>
    </aside>
  );
}
