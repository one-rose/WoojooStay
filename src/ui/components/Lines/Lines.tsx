import { Fragment } from "react";
import type { Lines as LinesValue } from "@/core";

/** 문장 배열을 <br> 로 이어 붙인다 */
export function Lines({ lines }: { lines: LinesValue }) {
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </>
  );
}
