import { notFound } from "next/navigation";

/**
 * 어느 화면에도 맞지 않는 주소 — Next 기본(영어) 404 대신 앱 모양의 "찾는 화면이 없어요" (D-13).
 * 루트 레이아웃이 여러 개라 전역 not-found 를 둘 수 없어서, 이 묶음 안에서 notFound() 로 바로 넘긴다.
 */
export default function UnknownRoute() {
  notFound();
}
