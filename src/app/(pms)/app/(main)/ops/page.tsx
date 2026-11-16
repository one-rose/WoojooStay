import { Suspense } from "react";
import type { Metadata } from "next";
import { isLiveApi } from "@/infrastructure";
import { OpsScreen } from "@/ui/pms";
import {
  addNoteAction,
  addRoomsAction,
  pinNoteAction,
  readNoteAction,
  removeNoteAction,
  roomLogsAction,
  setRoomStatusAction,
} from "../../_lib/actions";
import { getRepository } from "../../_lib/session";

export const metadata: Metadata = { title: "현장 업무" };

export default function OpsPage() {
  return (
    <Suspense fallback={<div className="pm-skeleton" aria-busy="true" aria-label="불러오는 중" />}>
      <Ops />
    </Suspense>
  );
}

async function Ops() {
  const pmsRepository = await getRepository();
  const data = await pmsRepository.getOps();
  return (
    <OpsScreen
      data={data}
      actions={
        isLiveApi
          ? {
              setRoomStatus: setRoomStatusAction,
              addRooms: addRoomsAction,
              roomLogs: roomLogsAction,
              addNote: addNoteAction,
              readNote: readNoteAction,
              pinNote: pinNoteAction,
              removeNote: removeNoteAction,
            }
          : undefined
      }
    />
  );
}
