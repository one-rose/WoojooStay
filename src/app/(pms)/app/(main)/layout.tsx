import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ApiError, isLiveApi } from "@/infrastructure";
import { AppShell } from "@/ui/pms";
import { readAllNotificationsAction, readNotificationAction, switchPropertyAction } from "../_lib/actions";
import { loadPropertySwitcher } from "../_lib/portfolio";
import { getRepository, isMyProperty, loadMe, readSession, redirectToPick } from "../_lib/session";

const ROLE_LABEL = { OWNER: "사장님", MANAGER: "매니저", STAFF: "직원" } as const;

/** 실증 기간 업장은 요금·재고(예시 데이터) 메뉴를 숨긴다 (API features.rates=false) */
async function loadHiddenNav(): Promise<string[]> {
  if (!isLiveApi) return [];
  const s = await readSession();
  if (!s.accessToken) return [];
  const me = await loadMe(s.accessToken).catch(() => null);
  const current = me?.properties.find((p) => p.id === s.propertyId);
  return current?.features?.rates === false ? ["/app/rates"] : [];
}

/** 상단 사용자 메뉴에 보일 이름 — 실패해도 화면은 그대로 */
async function loadUser() {
  if (!isLiveApi) return { name: "정현", roleLabel: "사장님" };
  const s = await readSession();
  if (!s.accessToken) return undefined;
  const me = await loadMe(s.accessToken).catch(() => null);
  if (!me) return undefined;
  const role = me.properties.find((p) => p.id === s.propertyId)?.role;
  return { name: me.name, roleLabel: role ? ROLE_LABEL[role] : "" };
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="pm-loading" aria-busy="true" aria-label="불러오는 중" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const repo = await getRepository();
  let loaded;
  const userLoad = loadUser();
  const hiddenLoad = loadHiddenNav();
  const switcherLoad = loadPropertySwitcher();
  try {
    loaded = await Promise.all([repo.getDashboard(), repo.getSettings()]);
  } catch (e) {
    // 직원(STAFF) 계정은 관리 화면 대신 본인 출퇴근 화면으로
    if (e instanceof ApiError && e.status === 403) redirect("/app/me");
    // 업장을 못 찾음 — 방금 그 업장에서 빠졌으면 남은 업장으로 다시 고른다 (아직 내 업장이면 진짜 오류)
    if (e instanceof ApiError && e.status === 404) {
      const s = await readSession();
      if (s.accessToken && s.propertyId && !(await isMyProperty(s.accessToken, s.propertyId, true)))
        await redirectToPick();
    }
    throw e;
  }
  const [dashboard, settings] = loaded;
  const switcher = await switcherLoad;
  // 업장이 여러 곳이면 종 알림은 업장 전부 (업장 이름을 붙여서)
  const allNotices = switcher.options.length >= 2 ? switcher.notifications : null;
  const channels = dashboard.channels;
  const synced = channels
    .filter((c) => c.status !== "error")
    .map((c) => c.lastSyncedAt)
    .sort();
  return (
    <AppShell
      property={dashboard.property}
      unansweredReviews={dashboard.unanswered.total}
      lastSyncedAt={synced[synced.length - 1] ?? "-"}
      syncErrors={channels.filter((c) => c.status === "error").length}
      notifications={allNotices ?? settings.notifications}
      logoutPath={isLiveApi ? "/app/session/logout" : undefined}
      user={await userLoad}
      readAllNotifications={
        isLiveApi ? (allNotices ? readAllNotificationsAction.bind(null, true) : readAllNotificationsAction) : undefined
      }
      readNotification={isLiveApi ? readNotificationAction : undefined}
      demo={!isLiveApi}
      properties={switcher.options}
      portfolioUnanswered={switcher.unanswered}
      switchProperty={switchPropertyAction}
      hiddenNav={await hiddenLoad}
    >
      {children}
    </AppShell>
  );
}
