/* eslint-disable @next/next/no-img-element -- 퍼블리싱 CSS 가 <img> 크기를 직접 정하므로 next/image 대신 일반 img 를 쓴다 */
import type { CSSProperties } from "react";
import type { StaticImageData } from "next/image";

interface ImgProps {
  src: StaticImageData;
  alt: string;
  className?: string;
  style?: CSSProperties;
  loading?: "lazy" | "eager";
}

/** 빌드 시 해시가 붙는 정적 이미지 (src/assets) 를 그대로 출력 */
export function Img({ src, alt, className, style, loading }: ImgProps) {
  return (
    <img
      src={src.src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={className}
      style={style}
      loading={loading}
      draggable={false}
    />
  );
}
