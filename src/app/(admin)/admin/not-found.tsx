import { ErrorState } from "@/ui/pms";

export default function AdminNotFound() {
  return (
    <ErrorState
      full
      title="찾는 화면이 없어요"
      message="주소를 다시 확인해 주세요."
      homeHref="/admin"
      homeLabel="운영자 홈으로"
    />
  );
}
