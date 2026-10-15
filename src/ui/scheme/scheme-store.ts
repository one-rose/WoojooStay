"use client";

import { SCHEME_ATTRIBUTE, SCHEME_STORAGE_KEY } from "./scheme-storage";

/** 현재 시안 = <html data-scheme> 값. React 밖의 작은 저장소로 관리한다 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function readScheme(): string | null {
  return document.documentElement.getAttribute(SCHEME_ATTRIBUTE);
}

export function writeScheme(id: string): void {
  document.documentElement.setAttribute(SCHEME_ATTRIBUTE, id);
  try {
    localStorage.setItem(SCHEME_STORAGE_KEY, id);
  } catch {
    /* 저장이 막힌 환경(시크릿 창 등)은 무시 */
  }
  listeners.forEach((listener) => listener());
}

export function subscribeScheme(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
