import type { CSSProperties } from "react";
import type { IllustrationId } from "@/core";
import { cx } from "@/shared";
import { ILLUSTRATIONS } from "./illustration-manifest";
import styles from "./Illustration.module.css";

interface IllustrationProps {
  id: IllustrationId;
  /**
   * 표시 높이(px). 주면 너비는 원본 비율로 계산한다.
   * 안 주면 className 에서 width 를 지정한다 (높이는 비율로 자동).
   */
  height?: number;
  className?: string;
  /** 설명이 필요한 그림일 때만. 없으면 장식으로 취급 */
  alt?: string;
}

/**
 * 시안마다 색조가 다른 3D 일러스트.
 * 이미지 주소는 시안 스타일시트의 CSS 변수(--illust-<id>)에 들어 있어서,
 * 시안을 바꾸면 자바스크립트 없이 CSS 만으로 그림이 바뀐다.
 */
export function Illustration({ id, height, className, alt }: IllustrationProps) {
  const natural = ILLUSTRATIONS.purple[id];
  const style = {
    aspectRatio: `${natural.width} / ${natural.height}`,
    backgroundImage: `var(${illustrationToken(id)})`,
    ...(height ? { height, width: Math.round((height * natural.width) / natural.height) } : null),
  } as CSSProperties;

  return (
    <span
      className={cx(styles.illustration, className)}
      style={style}
      role={alt ? "img" : undefined}
      aria-label={alt}
      aria-hidden={alt ? undefined : true}
    />
  );
}

export function illustrationToken(id: IllustrationId): `--${string}` {
  return `--illust-${id}`;
}
