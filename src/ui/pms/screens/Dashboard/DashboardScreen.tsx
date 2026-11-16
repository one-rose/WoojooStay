import Link from "next/link";
import { changeRate, type ChannelConnection, type DashboardData, type GuestReview } from "@/core";
import { daysBetween, formatLongDate, formatNumber, formatShortDate } from "@/shared";
import { Badge, Card, ChannelChip, Icon, PageHead, PmButton, Stars, Stat, StatRow } from "../../components";
import "./dashboard.css";

interface DashboardScreenProps {
  data: DashboardData;
  /** 답글 기다리는 리뷰 (낮은 별점 먼저) */
  pendingReviews: readonly GuestReview[];
}

const SYNC_BADGE: Record<ChannelConnection["status"], { tone: "ok" | "info" | "bad"; label: string }> = {
  ok: { tone: "ok", label: "정상" },
  syncing: { tone: "info", label: "수집 중" },
  error: { tone: "bad", label: "재인증 필요" },
};

export function DashboardScreen({ data, pendingReviews }: DashboardScreenProps) {
  const names = Object.fromEntries(data.channels.map((c) => [c.channel, c.name]));
  const rate = changeRate(data.todaySales.amount, data.todaySales.yesterday);
  const salesTotal = data.channelSales.reduce((sum, c) => sum + c.amount, 0);
  const maxSales = Math.max(1, ...data.channelSales.map((c) => c.amount));
  const errors = data.channels.filter((c) => c.status === "error");

  return (
    <div className="dash">
      <PageHead
        title={formatLongDate(data.date)}
        desc={
          data.channels.length
            ? `연동된 채널 ${data.channels.length}곳의 예약·리뷰·정산을 모아 보여드려요.`
            : "채널을 연결하면 예약·리뷰·정산을 여기에 모아 보여드려요."
        }
        actions={
          <>
            <PmButton icon="link" href="/app/settings/channels">
              채널 연동 관리
            </PmButton>
            <PmButton variant="primary" icon="edit" href="/app/reviews">
              답글 쓰기
            </PmButton>
          </>
        }
      />

      {errors.length > 0 && (
        <div className="dash-alert" role="status">
          <Icon name="alert" size={18} />
          <p>
            <strong>{errors.map((e) => e.name).join(", ")}</strong> 연동이 끊겼어요. 마지막 수집{" "}
            {errors[0].lastSyncedAt}. 다시 로그인하면 그동안의 예약·리뷰를 이어서 가져와요.
          </p>
          <PmButton size="sm" variant="navy" href="/app/settings/channels">
            다시 연결
          </PmButton>
        </div>
      )}

      <StatRow cols={3} label="오늘 요약">
        <Stat
          label="오늘 예약매출"
          prefix="₩"
          value={formatNumber(data.todaySales.amount)}
          delta={{ rate, label: "어제보다" }}
          foot={`예약 ${data.todaySales.bookings}건`}
        />
        <Stat
          label="답글 기다리는 리뷰"
          value={data.unanswered.total}
          suffix="건"
          href="/app/reviews"
          foot={data.unanswered.lowRating > 0 ? `별점 3점 이하 ${data.unanswered.lowRating}건` : "낮은 별점 없음"}
        />
        <Stat
          label="7일 안 정산 예정"
          prefix="₩"
          value={formatNumber(data.settlementWeek.amount)}
          foot={`${data.settlementWeek.count}개 채널`}
        />
      </StatRow>

      <div className="dash-grid">
        <Card
          className="dash-sales"
          title="채널별 예약매출"
          meta={<span className="num">합계 ₩{formatNumber(salesTotal)}</span>}
        >
          {salesTotal === 0 && <p className="dash-empty">오늘 들어온 예약이 아직 없어요.</p>}
          <ol className="dash-bars">
            {data.channelSales.map((c) => {
              const share = salesTotal > 0 ? Math.round((c.amount / salesTotal) * 1000) / 10 : 0;
              return (
                <li key={c.channel} className="dash-bars__row">
                  <ChannelChip channel={c.channel} name={names[c.channel]} />
                  <span className="dash-bars__track" aria-hidden>
                    <span className="dash-bars__fill" style={{ width: `${(c.amount / maxSales) * 100}%` }} />
                  </span>
                  <span className="dash-bars__amount num">₩{formatNumber(c.amount)}</span>
                  <span className="dash-bars__share num">{share}%</span>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card title="정산 예정" meta="7일 안">
          {data.settlements.length === 0 && <p className="dash-empty">7일 안에 들어올 정산이 없어요.</p>}
          <ol className="dash-settle">
            {data.settlements.map((s) => {
              const d = daysBetween(data.date, s.date);
              return (
                <li key={`${s.date}-${s.channel}`} className="dash-settle__row">
                  <span className="dash-settle__date">
                    <span className="num">{formatShortDate(s.date)}</span>
                    <small>D-{d}</small>
                  </span>
                  <ChannelChip channel={s.channel} name={names[s.channel]} />
                  <span className="dash-settle__amount num">₩{formatNumber(s.amount)}</span>
                </li>
              );
            })}
          </ol>
          <p className="dash-settle__total">
            <span>합계</span>
            <strong className="num">₩{formatNumber(data.settlementWeek.amount)}</strong>
          </p>
        </Card>

        <Card
          title="답글 기다리는 리뷰"
          action={
            <PmButton variant="quiet" size="sm" href="/app/reviews">
              전체 보기
            </PmButton>
          }
          flush
        >
          {pendingReviews.length === 0 && <p className="dash-empty dash-empty--pad">답글을 기다리는 리뷰가 없어요.</p>}
          <ul className="dash-reviews">
            {pendingReviews.map((r) => (
              <li key={r.id}>
                <Link href={`/app/reviews?id=${r.id}`} className="dash-reviews__row">
                  <span className="dash-reviews__meta">
                    <ChannelChip channel={r.channel} name={names[r.channel]} variant="icon" />
                    <Stars rating={r.rating} />
                    {r.needsReview && <Badge tone="warn">확인 필요</Badge>}
                  </span>
                  <span className="dash-reviews__body">{r.body}</span>
                  <span className="dash-reviews__when num">{r.postedAt.slice(5, 16).replace("-", ".")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="채널 연동 상태" meta={`${data.channels.length}곳`} flush>
          {data.channels.length === 0 && (
            <p className="dash-empty dash-empty--pad">
              아직 연결한 채널이 없어요. <Link href="/app/settings/channels">채널 연결하기</Link>
            </p>
          )}
          <ul className="dash-sync">
            {data.channels.map((c) => {
              const badge = SYNC_BADGE[c.status];
              return (
                <li key={c.channel} className="dash-sync__row">
                  <ChannelChip channel={c.channel} name={c.name} />
                  <span className="dash-sync__mode">{c.replyMode === "api" ? "자동 게시" : "복사 게시"}</span>
                  <span className="dash-sync__time num">{c.lastSyncedAt}</span>
                  <Badge tone={badge.tone} dot>
                    {badge.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
