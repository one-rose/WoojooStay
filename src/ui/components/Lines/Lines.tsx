import { Fragment } from "react";
import type { Lines as LinesValue } from "@/core";
import styles from "./Lines.module.css";

interface LinesProps {
  lines: LinesValue;
  /** true 면 태블릿 이하에서 줄바꿈을 없애고 한 문단으로 흐르게 한다 */
  collapseOnTablet?: boolean;
}

/** 줄 단위 문구를 <br> 로 이어 그린다 */
export function Lines({ lines, collapseOnTablet = false }: LinesProps) {
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <>
              {" "}
              <br className={collapseOnTablet ? styles.collapsible : undefined} />
            </>
          )}
          {line}
        </Fragment>
      ))}
    </>
  );
}
