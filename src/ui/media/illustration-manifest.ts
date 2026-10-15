// 시안별 일러스트 이미지 목록 (scripts/generate-illustration-manifest.mjs 로 생성 — 직접 수정하지 마세요)
import type { StaticImageData } from "next/image";
import type { IllustrationId, SchemeId } from "@/core";

import purple_chat from "@/assets/illustrations/purple/chat.webp";
import purple_data from "@/assets/illustrations/purple/data.webp";
import purple_finance from "@/assets/illustrations/purple/finance.webp";
import purple_join from "@/assets/illustrations/purple/join.webp";
import purple_ledger from "@/assets/illustrations/purple/ledger.webp";
import purple_mock_finance from "@/assets/illustrations/purple/mock-finance.webp";
import purple_mock_ledger from "@/assets/illustrations/purple/mock-ledger.webp";
import purple_mock_ops from "@/assets/illustrations/purple/mock-ops.webp";
import purple_ops from "@/assets/illustrations/purple/ops.webp";
import purple_people from "@/assets/illustrations/purple/people.webp";
import purple_receipt from "@/assets/illustrations/purple/receipt.webp";
import purple_revisit from "@/assets/illustrations/purple/revisit.webp";
import purple_robot from "@/assets/illustrations/purple/robot.webp";
import purple_wallet from "@/assets/illustrations/purple/wallet.webp";
import a_chat from "@/assets/illustrations/a/chat.webp";
import a_data from "@/assets/illustrations/a/data.webp";
import a_finance from "@/assets/illustrations/a/finance.webp";
import a_join from "@/assets/illustrations/a/join.webp";
import a_ledger from "@/assets/illustrations/a/ledger.webp";
import a_mock_finance from "@/assets/illustrations/a/mock-finance.webp";
import a_mock_ledger from "@/assets/illustrations/a/mock-ledger.webp";
import a_mock_ops from "@/assets/illustrations/a/mock-ops.webp";
import a_ops from "@/assets/illustrations/a/ops.webp";
import a_people from "@/assets/illustrations/a/people.webp";
import a_receipt from "@/assets/illustrations/a/receipt.webp";
import a_revisit from "@/assets/illustrations/a/revisit.webp";
import a_robot from "@/assets/illustrations/a/robot.webp";
import a_wallet from "@/assets/illustrations/a/wallet.webp";
import b_chat from "@/assets/illustrations/b/chat.webp";
import b_data from "@/assets/illustrations/b/data.webp";
import b_finance from "@/assets/illustrations/b/finance.webp";
import b_join from "@/assets/illustrations/b/join.webp";
import b_ledger from "@/assets/illustrations/b/ledger.webp";
import b_mock_finance from "@/assets/illustrations/b/mock-finance.webp";
import b_mock_ledger from "@/assets/illustrations/b/mock-ledger.webp";
import b_mock_ops from "@/assets/illustrations/b/mock-ops.webp";
import b_ops from "@/assets/illustrations/b/ops.webp";
import b_people from "@/assets/illustrations/b/people.webp";
import b_receipt from "@/assets/illustrations/b/receipt.webp";
import b_revisit from "@/assets/illustrations/b/revisit.webp";
import b_robot from "@/assets/illustrations/b/robot.webp";
import b_wallet from "@/assets/illustrations/b/wallet.webp";
import c_chat from "@/assets/illustrations/c/chat.webp";
import c_data from "@/assets/illustrations/c/data.webp";
import c_finance from "@/assets/illustrations/c/finance.webp";
import c_join from "@/assets/illustrations/c/join.webp";
import c_ledger from "@/assets/illustrations/c/ledger.webp";
import c_mock_finance from "@/assets/illustrations/c/mock-finance.webp";
import c_mock_ledger from "@/assets/illustrations/c/mock-ledger.webp";
import c_mock_ops from "@/assets/illustrations/c/mock-ops.webp";
import c_ops from "@/assets/illustrations/c/ops.webp";
import c_people from "@/assets/illustrations/c/people.webp";
import c_receipt from "@/assets/illustrations/c/receipt.webp";
import c_revisit from "@/assets/illustrations/c/revisit.webp";
import c_robot from "@/assets/illustrations/c/robot.webp";
import c_wallet from "@/assets/illustrations/c/wallet.webp";
import d_chat from "@/assets/illustrations/d/chat.webp";
import d_data from "@/assets/illustrations/d/data.webp";
import d_finance from "@/assets/illustrations/d/finance.webp";
import d_join from "@/assets/illustrations/d/join.webp";
import d_ledger from "@/assets/illustrations/d/ledger.webp";
import d_mock_finance from "@/assets/illustrations/d/mock-finance.webp";
import d_mock_ledger from "@/assets/illustrations/d/mock-ledger.webp";
import d_mock_ops from "@/assets/illustrations/d/mock-ops.webp";
import d_ops from "@/assets/illustrations/d/ops.webp";
import d_people from "@/assets/illustrations/d/people.webp";
import d_receipt from "@/assets/illustrations/d/receipt.webp";
import d_revisit from "@/assets/illustrations/d/revisit.webp";
import d_robot from "@/assets/illustrations/d/robot.webp";
import d_wallet from "@/assets/illustrations/d/wallet.webp";
import e_chat from "@/assets/illustrations/e/chat.webp";
import e_data from "@/assets/illustrations/e/data.webp";
import e_finance from "@/assets/illustrations/e/finance.webp";
import e_join from "@/assets/illustrations/e/join.webp";
import e_ledger from "@/assets/illustrations/e/ledger.webp";
import e_mock_finance from "@/assets/illustrations/e/mock-finance.webp";
import e_mock_ledger from "@/assets/illustrations/e/mock-ledger.webp";
import e_mock_ops from "@/assets/illustrations/e/mock-ops.webp";
import e_ops from "@/assets/illustrations/e/ops.webp";
import e_people from "@/assets/illustrations/e/people.webp";
import e_receipt from "@/assets/illustrations/e/receipt.webp";
import e_revisit from "@/assets/illustrations/e/revisit.webp";
import e_robot from "@/assets/illustrations/e/robot.webp";
import e_wallet from "@/assets/illustrations/e/wallet.webp";

export const ILLUSTRATIONS: Record<SchemeId, Record<IllustrationId, StaticImageData>> = {
  purple: {
    "chat": purple_chat,
    "data": purple_data,
    "finance": purple_finance,
    "join": purple_join,
    "ledger": purple_ledger,
    "mock-finance": purple_mock_finance,
    "mock-ledger": purple_mock_ledger,
    "mock-ops": purple_mock_ops,
    "ops": purple_ops,
    "people": purple_people,
    "receipt": purple_receipt,
    "revisit": purple_revisit,
    "robot": purple_robot,
    "wallet": purple_wallet,
  },
  a: {
    "chat": a_chat,
    "data": a_data,
    "finance": a_finance,
    "join": a_join,
    "ledger": a_ledger,
    "mock-finance": a_mock_finance,
    "mock-ledger": a_mock_ledger,
    "mock-ops": a_mock_ops,
    "ops": a_ops,
    "people": a_people,
    "receipt": a_receipt,
    "revisit": a_revisit,
    "robot": a_robot,
    "wallet": a_wallet,
  },
  b: {
    "chat": b_chat,
    "data": b_data,
    "finance": b_finance,
    "join": b_join,
    "ledger": b_ledger,
    "mock-finance": b_mock_finance,
    "mock-ledger": b_mock_ledger,
    "mock-ops": b_mock_ops,
    "ops": b_ops,
    "people": b_people,
    "receipt": b_receipt,
    "revisit": b_revisit,
    "robot": b_robot,
    "wallet": b_wallet,
  },
  c: {
    "chat": c_chat,
    "data": c_data,
    "finance": c_finance,
    "join": c_join,
    "ledger": c_ledger,
    "mock-finance": c_mock_finance,
    "mock-ledger": c_mock_ledger,
    "mock-ops": c_mock_ops,
    "ops": c_ops,
    "people": c_people,
    "receipt": c_receipt,
    "revisit": c_revisit,
    "robot": c_robot,
    "wallet": c_wallet,
  },
  d: {
    "chat": d_chat,
    "data": d_data,
    "finance": d_finance,
    "join": d_join,
    "ledger": d_ledger,
    "mock-finance": d_mock_finance,
    "mock-ledger": d_mock_ledger,
    "mock-ops": d_mock_ops,
    "ops": d_ops,
    "people": d_people,
    "receipt": d_receipt,
    "revisit": d_revisit,
    "robot": d_robot,
    "wallet": d_wallet,
  },
  e: {
    "chat": e_chat,
    "data": e_data,
    "finance": e_finance,
    "join": e_join,
    "ledger": e_ledger,
    "mock-finance": e_mock_finance,
    "mock-ledger": e_mock_ledger,
    "mock-ops": e_mock_ops,
    "ops": e_ops,
    "people": e_people,
    "receipt": e_receipt,
    "revisit": e_revisit,
    "robot": e_robot,
    "wallet": e_wallet,
  },
};
