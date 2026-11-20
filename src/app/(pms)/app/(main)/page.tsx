import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardScreen, ScreenSkeleton } from "@/ui/pms";
import { getRepository } from "../_lib/session";

export const metadata: Metadata = { title: "홈" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<ScreenSkeleton strip={3} rows={4} />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const repo = await getRepository();
  const [data, reviews] = await Promise.all([repo.getDashboard(), repo.getReviews()]);
  const pending = reviews
    .filter((r) => r.status === "unanswered")
    .sort((a, b) => a.rating - b.rating || b.postedAt.localeCompare(a.postedAt))
    .slice(0, 5);
  return (
    <DashboardScreen
      data={data}
      pendingReviews={pending}
      hasReplied={reviews.some((r) => r.status === "posted" && !r.replyExternal)}
    />
  );
}
