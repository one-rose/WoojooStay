import { Fragment } from "react";
import type { Lines as LinesValue } from "@/core";
import { needsSpaceBetween } from "@/shared";

/**
 * 문장 배열을 <br> 로 이어 붙인다.
 * 화면이 좁아 CSS 로 <br> 을 숨기면 줄이 한 문장으로 합쳐지므로,
 * 한국어·영어는 줄 사이에 띄어쓰기를 넣어 단어가 붙지 않게 한다.
 */
export function Lines({ lines }: { lines: LinesValue }) {
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <>
              {needsSpaceBetween(lines[i - 1], line) && " "}
              <br />
            </>
          )}
          {line}
        </Fragment>
      ))}
    </>
  );
}
