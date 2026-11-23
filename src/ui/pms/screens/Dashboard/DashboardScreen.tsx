import Link from "next/link";
import { changeRate, type ChannelConnection, type DashboardData, type GuestReview } from "@/core";
import { daysBetween, formatLongDate, formatNumber, formatShortDate, formatWon, josa } from "@/shared";
import { Badge, Card, ChannelChip, Icon, NextPayout, PageHead, PmButton, Stars, Stat, StatRow } from "../../components";
import "./dashboard.css";

interface DashboardScreenProps {
  data: DashboardData;
  /** 답글 기다리는 리뷰 (낮은 별점 먼저) */
  pendingReviews: readonly GuestReview[];
  /** 답글을 한 번이라도 게시했는지 — 시작하기 체크리스트 */
  hasReplied?: boolean;
}

/** 시작하기 — 업장 등록 뒤 첫 가치까지 남은 일 */
function StartChecklist({
  channels,
  replied,
  unanswered,
  hideAction,
}: {
  channels: number;
  replied: boolean;
  unanswered: number;
  /** 위에 같은 버튼이 이미 있으면 숨긴다 */
  hideAction?: boolean;
}) {
  const steps = [
    { done: true, label: "업장 등록", href: undefined, action: "" },
    {
      done: channels > 0,
      label: `예약 채널 연결 ${Math.min(channels, 1)}/1`,
      href: "/app/settings/channels",
      action: "채널 연결하기",
    },
    {
      done: replied,
      label: "첫 답글 게시",
      href: unanswered > 0 ? "/app/reviews?tab=low" : "/app/reviews",
      action: unanswered > 0 ? "답글 초안 보기" : "리뷰 보기",
    },
  ];
  const left = steps.filter((x) => !x.done).length;
  // 다음에 할 일 하나만 버튼으로
  const next = steps.find((x) => !x.done);
  return (
    <section className="dash-start" aria-labelledby="dash-start-title">
      <header className="dash-start__head">
        <h2 id="dash-start-title">시작하기</h2>
        <span className="num">
          {steps.length - left}/{steps.length}
        </span>
      </header>
      <ol className="dash-start__list">
        {steps.map((x) => (
          <li key={x.label} className={x.done ? "is-done" : undefined}>
            <span className="dash-start__mark" aria-hidden>
              {x.done && <Icon name="check" size={13} />}
            </span>
            <span className="dash-start__label">{x.label}</span>
            {x === next && x.href && !hideAction && (
              <PmButton size="sm" href={x.href}>
                {x.action}
              </PmButton>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 연동 상태 — 정상은 배지 없이 회색 수집 시각만, 문제·진행 중일 때만 배지 (D-02) */
const SYNC_BADGE: Record<ChannelConnection["status"], { tone: "info" | "bad"; label: string } | null> = {
  ok: null,
  syncing: { tone: "info", label: "수집 중" },
  error: { tone: "bad", label: "연동 끊김" },
};

/** 다음 입금 — 가장 가까운 정산일 하루치 합계와 채널 이름 (S3) */
function nextPayout(data: DashboardData, names: Record<string, string>) {
  const first = [...data.settlements].sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!first) return null;
  const same = data.settlements.filter((s) => s.date === first.date);
  const amount = same.reduce((sum, s) => sum + s.amount, 0);
  const firstName = names[same[0].channel] ?? same[0].channel;
  return { date: first.date, amount, note: same.length > 1 ? `${firstName} 외 ${same.length - 1}곳` : firstName };
}

export function DashboardScreen({ data, pendingReviews, hasReplied = true }: DashboardScreenProps) {
  const names = Object.fromEntries(data.channels.map((c) => [c.channel, c.name]));
  const rate = changeRate(data.todaySales.amount, data.todaySales.yesterday);
  const salesTotal = data.channelSales.reduce((sum, c) => sum + c.amount, 0);
  const maxSales = Math.max(1, ...data.channelSales.map((c) => c.amount));
  const errors = data.channels.filter((c) => c.status === "error");
  const reviewsHref = data.unanswered.lowRating > 0 ? "/app/reviews?tab=low" : "/app/reviews";
  const payout = nextPayout(data, names);

  // 채널이 하나도 없으면 ₩0 숫자 대신 큰 안내 하나
  if (data.channels.length === 0) {
    return (
      <div className="dash">
        <PageHead
          title={formatLongDate(data.date)}
          desc={`${josa(data.property.name, "을/를")} 등록했어요. 이제 채널만 연결하면 돼요.`}
        />
        <section className="dash-empty-home">
          <h2>채널 하나만 연결하면 리뷰 답글 초안을 바로 만들어 드려요</h2>
          <p>
            야놀자·여기어때·네이버 같은 파트너센터 아이디로 연결하면 최근 90일 예약·리뷰·정산을 가져와요. 비밀번호는
            암호화해 보관하고, 언제든 연결을 끊을 수 있어요.
          </p>
          <PmButton variant="primary" icon="link" href="/app/settings/channels">
            채널 연결하기
          </PmButton>
        </section>
        <StartChecklist channels={0} replied={hasReplied} unanswered={0} hideAction />
      </div>
    );
  }

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
            <PmButton variant="primary" icon="edit" href={reviewsHref}>
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
          <PmButton size="sm" variant="alert" href={`/app/settings/channels?channel=${errors[0].channel}`}>
            다시 연결
          </PmButton>
        </div>
      )}

      {payout && <NextPayout today={data.date} date={payout.date} amount={payout.amount} note={payout.note} />}

      {!hasReplied && (
        <StartChecklist channels={data.channels.length} replied={hasReplied} unanswered={data.unanswered.total} />
      )}

      <StatRow cols={3} label="오늘 요약">
        <Stat
          icon="money_bag"
          label="오늘 입실 매출"
          prefix="₩"
          value={formatNumber(data.todaySales.amount)}
          delta={{ rate, label: "어제보다" }}
          foot={`예약 ${data.todaySales.bookings}건`}
        />
        <Stat
          icon="speech_balloon"
          label="답글 기다리는 리뷰"
          value={data.unanswered.total}
          suffix="건"
          href={reviewsHref}
          foot={data.unanswered.lowRating > 0 ? `별점 3점 이하 ${data.unanswered.lowRating}건` : "낮은 별점 없음"}
        />
        <Stat
          icon="bank"
          label="7일 안 정산 예정"
          prefix="₩"
          value={formatNumber(data.settlementWeek.amount)}
          foot={`${data.settlementWeek.count}개 채널`}
        />
      </StatRow>

      <div className="dash-grid">
        <Card
          className="dash-sales"
          title="채널별 오늘 입실 매출"
          meta={<span className="num">합계 {formatWon(salesTotal)}</span>}
        >
          {salesTotal === 0 && <p className="dash-empty">오늘 들어온 예약이 아직 없어요.</p>}
          <ol className="dash-bars">
            {data.channelSales.map((c) => {
              const share = salesTotal > 0 ? Math.round((c.amount / salesTotal) * 100) : 0;
              return (
                <li key={c.channel} className="dash-bars__row">
                  <ChannelChip channel={c.channel} name={names[c.channel]} />
                  <span className="dash-bars__track" aria-hidden>
                    <span className="dash-bars__fill" style={{ width: `${(c.amount / maxSales) * 100}%` }} />
                  </span>
                  <span className="dash-bars__amount num">{formatWon(c.amount)}</span>
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
                    <small>{d === 0 ? "오늘" : d === 1 ? "내일" : `${d}일 뒤`}</small>
                  </span>
                  <ChannelChip channel={s.channel} name={names[s.channel]} />
                  <span className="dash-settle__amount num">{formatWon(s.amount)}</span>
                </li>
              );
            })}
          </ol>
          <p className="dash-settle__total">
            <span>합계</span>
            <strong className="num">{formatWon(data.settlementWeek.amount)}</strong>
          </p>
        </Card>

        <Card
          title="답글 기다리는 리뷰"
          action={
            <PmButton variant="quiet" size="sm" href={reviewsHref}>
              {data.unanswered.lowRating > 0 ? "낮은 별점부터 보기" : "전체 보기"}
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
                  <span className="dash-sync__mode">{c.replyMode === "api" ? "자동 등록" : "직접 붙여넣기"}</span>
                  {badge ? (
                    <Badge tone={badge.tone} dot>
                      {badge.label}
                    </Badge>
                  ) : (
                    <span className="dash-sync__time num" title="마지막 수집">
                      {c.lastSyncedAt}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
