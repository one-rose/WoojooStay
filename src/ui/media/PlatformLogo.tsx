import Image, { type StaticImageData } from "next/image";
import type { ChannelId, PlatformId } from "@/core";
import chipAgoda from "@/assets/platforms/chip-agoda.webp";
import chipNaver from "@/assets/platforms/chip-naver.webp";
import chipYanolja from "@/assets/platforms/chip-yanolja.webp";
import chipYeogi from "@/assets/platforms/chip-yeogi.webp";
import cardAgoda from "@/assets/platforms/card-agoda.webp";
import cardNaver from "@/assets/platforms/card-naver.webp";
import cardYanolja from "@/assets/platforms/card-yanolja.webp";
import iconAgoda from "@/assets/platforms/icon-agoda.webp";
import iconAirbnb from "@/assets/platforms/icon-airbnb.webp";
import iconBear from "@/assets/platforms/icon-bear.webp";
import iconKkulstay from "@/assets/platforms/icon-kkulstay.webp";
import iconNaver from "@/assets/platforms/icon-naver.webp";
import iconYanolja from "@/assets/platforms/icon-yanolja.webp";
import iconYeogi from "@/assets/platforms/icon-yeogi.webp";

export const PLATFORM_NAMES: Record<ChannelId, string> = {
  yanolja: "야놀자",
  yeogi: "여기어때",
  naver: "네이버 예약",
  agoda: "아고다",
  kkulstay: "꿀스테이",
  bear: "기타 채널",
  airbnb: "에어비앤비",
  other: "기타",
};

interface Asset {
  src: StaticImageData;
  /** 화면 표시 높이(px) */
  height: number;
}

/** 플랫폼 띠(로고 칩)용 워드마크 */
const CHIP: Record<PlatformId, Asset> = {
  yanolja: { src: chipYanolja, height: 24 },
  yeogi: { src: chipYeogi, height: 16 },
  agoda: { src: chipAgoda, height: 32 },
  naver: { src: chipNaver, height: 30 },
};

/** 리뷰 카드 오른쪽 위 로고 */
const CARD: Record<PlatformId, Asset> = {
  yanolja: { src: cardYanolja, height: 20 },
  yeogi: { src: chipYeogi, height: 15 },
  naver: { src: cardNaver, height: 26 },
  agoda: { src: cardAgoda, height: 26 },
};

/** 채널 그래프 아래 앱 아이콘 (16px 정사각형) */
const ICON: Partial<Record<ChannelId, StaticImageData>> = {
  yanolja: iconYanolja,
  yeogi: iconYeogi,
  naver: iconNaver,
  agoda: iconAgoda,
  kkulstay: iconKkulstay,
  bear: iconBear,
  airbnb: iconAirbnb,
};

interface PlatformLogoProps {
  platform: PlatformId;
  variant: "chip" | "card";
  className?: string;
  /** 주변에 이미 이름이 적혀 있으면 true (스크린리더 중복 방지) */
  decorative?: boolean;
}

export function PlatformLogo({ platform, variant, className, decorative = false }: PlatformLogoProps) {
  const asset = (variant === "chip" ? CHIP : CARD)[platform];
  return (
    <Image
      src={asset.src}
      alt={decorative ? "" : PLATFORM_NAMES[platform]}
      className={className}
      style={{ height: asset.height, width: "auto" }}
      sizes={`${Math.ceil((asset.height * asset.src.width) / asset.src.height)}px`}
    />
  );
}

interface ChannelIconProps {
  channel: ChannelId;
  className?: string;
}

/** 채널 앱 아이콘. 아이콘이 없는 채널은 빈 자리만 차지한다 */
export function ChannelIcon({ channel, className }: ChannelIconProps) {
  const src = ICON[channel];
  if (!src) return <span className={className} aria-hidden="true" />;
  return <Image src={src} alt={PLATFORM_NAMES[channel]} className={className} width={16} height={16} />;
}
