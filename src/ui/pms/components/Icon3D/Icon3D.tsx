import { cx } from "@/shared";

/**
 * 3D 아이콘 — Microsoft Fluent Emoji 3D (MIT, public/pm-icons/FLUENT-EMOJI-LICENSE.txt). 앱과 같은 그림.
 * 장식이라 읽어 주지 않는다 (옆 글자가 뜻을 말한다).
 */
export function Icon3D({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 작은 장식 PNG, 최적화 경로를 거칠 필요 없음
    <img
      src={`/pm-icons/${name}.png`}
      alt=""
      width={size}
      height={size}
      className={cx("pm-icon3d", className)}
      aria-hidden="true"
    />
  );
}
