import type { StaticImageData } from "next/image";
import type { PlatformId, ReviewPhotoId } from "@/core";
import agodaChannel from "@/assets/platforms/channel/agoda.webp";
import ddnayoChannel from "@/assets/platforms/channel/ddnayo.webp";
import hotelsChannel from "@/assets/platforms/channel/hotels.webp";
import kkulChannel from "@/assets/platforms/channel/kkul.webp";
import naverChannel from "@/assets/platforms/channel/naver.webp";
import ondaChannel from "@/assets/platforms/channel/onda.webp";
import tripChannel from "@/assets/platforms/channel/trip.webp";
import yanoljaChannel from "@/assets/platforms/channel/yanolja.webp";
import yeogiChannel from "@/assets/platforms/channel/yeogi.webp";
import agodaLogo from "@/assets/platforms/logo/agoda.webp";
import ddnayoLogo from "@/assets/platforms/logo/ddnayo.png";
import hotelsLogo from "@/assets/platforms/logo/hotels.png";
import kkulLogo from "@/assets/platforms/logo/kkul.png";
import naverLogo from "@/assets/platforms/logo/naver.webp";
import ondaLogo from "@/assets/platforms/logo/onda.png";
import tripLogo from "@/assets/platforms/logo/trip.png";
import yanoljaLogo from "@/assets/platforms/logo/yanolja.webp";
import yeogiLogo from "@/assets/platforms/logo/yeogi.webp";
import agodaReview from "@/assets/platforms/review/agoda.webp";
import naverReview from "@/assets/platforms/review/naver.webp";
import yanoljaReview from "@/assets/platforms/review/yanolja.webp";
import yeogiReview from "@/assets/platforms/review/yeogi.webp";
import breakfastPhoto from "@/assets/reviews/breakfast.webp";
import cityroomPhoto from "@/assets/reviews/cityroom.webp";
import hallPhoto from "@/assets/reviews/hall.webp";
import lobbyPhoto from "@/assets/reviews/lobby.webp";
import roomPhoto from "@/assets/reviews/room.webp";
import { Img } from "./Img";

/** 로고 이미지 + 표시 높이(px). 로고마다 여백이 달라 시안에 맞춰 높이를 따로 정했다. */
type Sized = readonly [StaticImageData, number];

/** 플랫폼 띠의 큰 로고 */
const STRIP_LOGOS: Record<PlatformId, Sized> = {
  yanolja: [yanoljaLogo, 24],
  yeogi: [yeogiLogo, 16],
  agoda: [agodaLogo, 32],
  naver: [naverLogo, 30],
  trip: [tripLogo, 26],
  hotels: [hotelsLogo, 22],
  onda: [ondaLogo, 20],
  kkul: [kkulLogo, 26],
  ddnayo: [ddnayoLogo, 24],
};

/** 리뷰 카드 오른쪽 위 로고 (리뷰 예시가 있는 채널만) */
const REVIEW_LOGOS: Partial<Record<PlatformId, Sized>> = {
  yanolja: [yanoljaReview, 20],
  yeogi: [yeogiReview, 15],
  naver: [naverReview, 26],
  agoda: [agodaReview, 26],
};

/** 그래프 아래 둥근 채널 아이콘 */
const CHANNEL_ICONS: Record<PlatformId, StaticImageData> = {
  yanolja: yanoljaChannel,
  yeogi: yeogiChannel,
  agoda: agodaChannel,
  naver: naverChannel,
  trip: tripChannel,
  hotels: hotelsChannel,
  onda: ondaChannel,
  kkul: kkulChannel,
  ddnayo: ddnayoChannel,
};

const REVIEW_PHOTOS: Record<ReviewPhotoId, StaticImageData> = {
  lobby: lobbyPhoto,
  hall: hallPhoto,
  breakfast: breakfastPhoto,
  room: roomPhoto,
  cityroom: cityroomPhoto,
};

interface PlatformLogoProps {
  platform: PlatformId;
  variant: "strip" | "review";
  alt: string;
}

export function PlatformLogo({ platform, variant, alt }: PlatformLogoProps) {
  const sized = variant === "strip" ? STRIP_LOGOS[platform] : REVIEW_LOGOS[platform];
  if (!sized) return null;
  const [src, height] = sized;
  return <Img src={src} alt={alt} style={{ height }} />;
}

export function ChannelIcon({ platform, alt, className }: { platform: PlatformId; alt: string; className?: string }) {
  return <Img src={CHANNEL_ICONS[platform]} alt={alt} className={className} />;
}

export function ReviewPhoto({ photo, alt }: { photo: ReviewPhotoId; alt: string }) {
  return <Img src={REVIEW_PHOTOS[photo]} alt={alt} loading="lazy" />;
}
