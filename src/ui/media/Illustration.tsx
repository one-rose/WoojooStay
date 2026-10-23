import type { StaticImageData } from "next/image";
import type { IllustrationId } from "@/core";
import { cx } from "@/shared";
import chat from "@/assets/illustrations/chat.webp";
import data from "@/assets/illustrations/data.webp";
import finance from "@/assets/illustrations/finance.webp";
import join from "@/assets/illustrations/join.webp";
import ledger from "@/assets/illustrations/ledger.webp";
import ops from "@/assets/illustrations/ops.webp";
import people from "@/assets/illustrations/people.webp";
import receipt from "@/assets/illustrations/receipt.webp";
import revisit from "@/assets/illustrations/revisit.webp";
import wallet from "@/assets/illustrations/wallet.webp";
import robot from "@/assets/illustrations/robot.webp";
import mock_ledger from "@/assets/illustrations/mock-ledger.webp";
import mock_finance from "@/assets/illustrations/mock-finance.webp";
import mock_ops from "@/assets/illustrations/mock-ops.webp";
import robot_notext from "@/assets/illustrations/notext/robot.webp";
import mock_ledger_notext from "@/assets/illustrations/notext/mock-ledger.webp";
import mock_finance_notext from "@/assets/illustrations/notext/mock-finance.webp";
import mock_ops_notext from "@/assets/illustrations/notext/mock-ops.webp";
import { Img } from "./Img";

const ILLUSTRATIONS: Record<IllustrationId, StaticImageData> = {
  chat: chat,
  data: data,
  finance: finance,
  join: join,
  ledger: ledger,
  ops: ops,
  people: people,
  receipt: receipt,
  revisit: revisit,
  wallet: wallet,
  robot: robot,
  "mock-ledger": mock_ledger,
  "mock-finance": mock_finance,
  "mock-ops": mock_ops,
  "robot-notext": robot_notext,
  "mock-ledger-notext": mock_ledger_notext,
  "mock-finance-notext": mock_finance_notext,
  "mock-ops-notext": mock_ops_notext,
};

/** 3D 일러스트 (컬러 시안 C). 크기는 사용하는 곳의 CSS 가 정한다. */
export function Illustration({ id, className, alt = "" }: { id: IllustrationId; className?: string; alt?: string }) {
  return <Img src={ILLUSTRATIONS[id]} alt={alt} className={cx("illust", className)} />;
}
