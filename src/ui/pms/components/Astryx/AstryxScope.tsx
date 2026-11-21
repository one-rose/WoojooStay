"use client";

import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
import "./astryx-theme.css";
import { InternationalizationProvider } from "@astryxdesign/core/i18n";
import koKR from "@astryxdesign/core/locales/ko-KR.generated.js";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import type { ReactNode } from "react";

/**
 * 아스트릭스(Meta 디자인 시스템) 범위 — 로그인 · 가입 · 온보딩 · 초대 · 운영자 화면에만 씌운다.
 * 사장님 업무 화면(/app)과 랜딩은 이 범위 밖 (기존 PmButton · Field 그대로).
 *
 * 색 · 글꼴 · 둥글기는 아스트릭스 기본(neutral)을 우리 토큰으로 덮는다 (astryx-theme.css).
 * 아스트릭스 CSS 는 cascade layer 안에 있어서, 레이어 밖인 우리 CSS 가 항상 이긴다.
 * 화면은 아스트릭스를 직접 import 하지 않고 AxButton · AxTextField 를 쓴다 (나중에 바꾸기 쉽게).
 */
export function AstryxScope({ children }: { children: ReactNode }) {
  return (
    <InternationalizationProvider locale="ko-KR" messages={{ "ko-KR": koKR }}>
      <Theme theme={neutralTheme} mode="light">
        {children}
      </Theme>
    </InternationalizationProvider>
  );
}
