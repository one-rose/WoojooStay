import { ErrorState } from "@/ui/pms";

export default function AppNotFound() {
  return (
    <ErrorState
      full
      title="찾는 화면이 없어요"
      message="주소가 바뀌었거나 지워진 화면이에요. 홈에서 다시 찾아 주세요."
      homeHref="/app"
    />
  );
}
