/**
 * shared — 어느 레이어에서나 쓰는 순수 유틸리티
 * 규칙: 다른 레이어(core · infrastructure · ui · app)를 import 하지 않는다.
 */
export { cx } from "./lib/cx";
export { formatNumber, formatMillions } from "./lib/format";
export { smoothPath, type Point } from "./lib/smooth-path";
