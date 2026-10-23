"use client";

import { useState } from "react";
import type { UseCasesContent } from "@/core";
import { cx } from "@/shared";
import { OrbMark } from "../../brand";
import { PropertyIcon } from "../../components";

/** 숙박 유형 탭 + 선택된 유형의 설명 패널 */
export function UseCaseTabs({ content }: { content: UseCasesContent }) {
  const [selected, setSelected] = useState(0);
  const current = content.cases[selected];

  return (
    <>
      <div className="cases__tabs" role="tablist">
        {content.cases.map((useCase, i) => (
          <button
            key={useCase.type}
            type="button"
            role="tab"
            aria-selected={i === selected}
            className={cx("cases__tab", i === selected && "is-on")}
            onClick={() => setSelected(i)}
          >
            <PropertyIcon type={useCase.type} className="cases__ico" />
            {useCase.label}
          </button>
        ))}
      </div>
      {/* key 를 바꿔 탭이 바뀔 때마다 등장 애니메이션을 다시 재생 */}
      <div className="cases__panel" role="tabpanel" key={selected}>
        <div className="cases__copy">
          <h3>{current.headline}</h3>
          <ul>
            {current.points.map((point) => (
              <li key={point}>
                <OrbMark />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="cases__chips">
          <span className="cases__chips-label">{content.recommendLabel}</span>
          {current.services.map((service, i) => (
            <span key={service} className="cases__chip">
              <b>{String(i + 1).padStart(2, "0")}</b>
              {service}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
