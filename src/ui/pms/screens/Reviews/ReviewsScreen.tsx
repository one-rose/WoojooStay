"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  matchesReviewTab,
  type ChannelConnection,
  type ChannelId,
  type GuestReview,
  type ReviewActions,
  type ReviewTab,
} from "@/core";
import { cx, josa } from "@/shared";
import { ReviewPhoto } from "@/ui/media";
import { Badge, ChannelChip, Icon, PageHead, PmButton, Stars, Tag } from "../../components";
import "./reviews.css";

interface ReviewsScreenProps {
  reviews: readonly GuestReview[];
  channels: readonly ChannelConnection[];
  /** 홈에서 특정 리뷰를 눌러 들어온 경우 (?id=r3) */
  initialId?: string | null;
  /** 실서버 게시·AI 다시 쓰기. 없으면 화면만 동작하는 시안 */
  actions?: ReviewActions;
  /**
   * 통합 리뷰함(F8) — 업장 여러 곳의 리뷰를 한 목록에. 리뷰마다 propertyId 가 있고,
   * 업장으로 거르고 · 목록과 상세에 업장 이름을 보이고 · 답글은 그 업장으로 게시한다.
   */
  inbox?: { properties: readonly { id: string; name: string }[]; truncated?: boolean };
  /** 통합 리뷰함을 이 업장으로 걸러서 연다 (?property=) */
  initialProperty?: string | null;
}

const TABS: readonly { id: ReviewTab; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "unanswered", label: "미답변" },
  { id: "positive", label: "긍정" },
  { id: "improve", label: "개선요청" },
];

type Sort = "latest" | "low";

interface LocalState {
  draft: string;
  posted?: { text: string; via: "api" | "copy" };
}

/** 연결이 끊긴 채널의 리뷰도 보이도록 — 채널 정보가 없으면 복사 게시로 본다 */
const fallbackChannel = (id: ChannelId): ChannelConnection => ({
  channel: id,
  name: id,
  replyMode: "copy",
  status: "error",
  lastSyncedAt: "-",
});

type Toast = { text: string; bad: boolean };

export function ReviewsScreen({ reviews, channels, initialId, actions, inbox, initialProperty }: ReviewsScreenProps) {
  const router = useRouter();
  // 서버 목록이 새로 오면(router.refresh) 그것으로 바꾼다
  const [base, setBase] = useState(reviews);
  const [items, setItems] = useState(reviews);
  if (base !== reviews) {
    setBase(reviews);
    setItems(reviews);
  }
  const [pending, start] = useTransition();
  const linked = initialId && items.some((r) => r.id === initialId) ? initialId : null;
  const channelMap = useMemo(
    () => Object.fromEntries(channels.map((c) => [c.channel, c])) as Partial<Record<ChannelId, ChannelConnection>>,
    [channels],
  );
  const conn = (id: ChannelId) => channelMap[id] ?? fallbackChannel(id);
  const [tab, setTab] = useState<ReviewTab>(linked ? "all" : "unanswered");
  const [channel, setChannel] = useState<ChannelId | "all">("all");
  const propertyNames = useMemo(
    () => new Map((inbox?.properties ?? []).map((p) => [p.id, p.name])),
    [inbox?.properties],
  );
  const [propertyFilter, setPropertyFilter] = useState<string>(
    initialProperty && propertyNames.has(initialProperty) ? initialProperty : "all",
  );
  const inProperty = (r: GuestReview) => propertyFilter === "all" || r.propertyId === propertyFilter;
  const propertyOf = (r: GuestReview) => (inbox && r.propertyId ? propertyNames.get(r.propertyId) : undefined);
  const [sort, setSort] = useState<Sort>("latest");
  const [selectedId, setSelectedId] = useState<string | null>(linked);
  const [mobileDetail, setMobileDetail] = useState(!!linked);
  const [local, setLocal] = useState<Record<string, LocalState>>(() =>
    Object.fromEntries(items.map((r) => [r.id, { draft: r.aiDraft }])),
  );
  const stateOf = (r: GuestReview): LocalState => local[r.id] ?? { draft: r.aiDraft };
  const [toast, setToastState] = useState<Toast | null>(null);
  const setToast = (text: string, bad = false) => setToastState({ text, bad });

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToastState(null), toast.bad ? 6000 : 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const isAnswered = (r: GuestReview) => r.status === "posted" || !!local[r.id]?.posted;
  const effective = (r: GuestReview): GuestReview => (isAnswered(r) ? { ...r, status: "posted" } : r);

  const counts = useMemo(() => {
    const out = {} as Record<ReviewTab, number>;
    const scoped = items.filter(inProperty);
    for (const t of TABS) out[t.id] = scoped.filter((r) => matchesReviewTab(effective(r), t.id)).length;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- local · 업장 필터가 바뀌면 다시 계산
  }, [items, local, propertyFilter]);

  const list = useMemo(() => {
    const filtered = items
      .filter((r) => matchesReviewTab(effective(r), tab))
      .filter(inProperty)
      .filter((r) => channel === "all" || r.channel === channel);
    return [...filtered].sort((a, b) =>
      sort === "low"
        ? a.rating - b.rating || b.postedAt.localeCompare(a.postedAt)
        : b.postedAt.localeCompare(a.postedAt),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- local · 업장 필터가 바뀌면 다시 계산
  }, [items, tab, channel, sort, local, propertyFilter]);

  const selected = list.find((r) => r.id === selectedId) ?? list[0] ?? null;

  const select = (id: string) => {
    setSelectedId(id);
    setMobileDetail(true);
  };

  const replace = (r: GuestReview) => setItems((list) => list.map((x) => (x.id === r.id ? r : x)));

  const redraft = (review: GuestReview) =>
    actions &&
    start(async () => {
      const r = await actions.redraft(review.id, review.propertyId);
      if (!r.ok) return setToast(r.message, true);
      replace(r.data.review);
      setLocal((prev) => ({ ...prev, [review.id]: { draft: r.data.review.aiDraft } }));
    });

  const markPosted = (review: GuestReview, text: string, via: "api" | "copy") =>
    setLocal((prev) => ({ ...prev, [review.id]: { draft: text, posted: { text, via } } }));

  const post = (review: GuestReview) => {
    const draft = stateOf(review).draft;
    const c = conn(review.channel);
    if (!draft.trim()) return;
    // 복사 게시: 클릭한 그 순간에 복사하고 창을 연다 (서버를 기다리면 브라우저가 팝업·복사를 막는다)
    let win: Window | null = null;
    if (c.replyMode === "copy") {
      void navigator.clipboard?.writeText(draft).catch(() => undefined);
      if (actions) win = window.open("", "_blank");
    }
    if (actions) {
      start(async () => {
        const r = await actions.reply(review.id, draft, review.propertyId);
        if (!r.ok) {
          win?.close();
          return setToast(r.message, true);
        }
        replace(r.data.review);
        if (r.data.copyTo && win) {
          win.opener = null;
          win.location.href = r.data.copyTo;
        } else win?.close();
        setToast(
          c.replyMode === "copy"
            ? `답글을 복사했어요. 열린 ${c.name} 파트너센터에 붙여넣어 주세요.`
            : `${c.name}에 답글을 게시했어요.`,
        );
        markPosted(review, draft, c.replyMode);
        // 사이드바 미답변 수 · 홈 숫자도 새로
        router.refresh();
      });
      return;
    }
    setToast(
      c.replyMode === "copy"
        ? `답글을 복사했어요. ${c.name} 파트너센터에 붙여넣으면 게시 완료로 표시돼요.`
        : `${c.name}에 답글을 게시했어요.`,
    );
    markPosted(review, draft, c.replyMode);
  };

  return (
    <div className="rv">
      {inbox ? (
        <PageHead
          title="통합 리뷰함"
          desc={`업장 ${inbox.properties.length}곳의 리뷰를 한곳에서 답해요. 미답변은 전부, 답글을 단 리뷰는 최근 7일 것만 보여요.`}
        />
      ) : (
        <PageHead
          title="리뷰 관리"
          desc="채널마다 흩어진 리뷰를 모으고, 리뷰 내용을 짚은 답글 초안을 미리 써 둬요. 확인하고 게시만 하면 돼요."
          actions={
            <PmButton icon="settings" href="/app/reviews/settings">
              답글 말투 설정
            </PmButton>
          }
        />
      )}
      {inbox?.truncated && (
        <p className="rv-note">
          미답변 리뷰가 많아 최근 1,000건만 보여요. 오래된 리뷰는 업장별 리뷰 관리에서 볼 수 있어요.
        </p>
      )}

      <div className="rv-toolbar">
        <div className="rv-tabs" role="tablist" aria-label="리뷰 분류">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={cx("rv-tabs__tab", tab === t.id && "is-on")}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className="rv-tabs__count num">{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <div className="rv-filters">
          {inbox && (
            <label className="rv-select rv-select--wide">
              <span className="pm-sr">업장</span>
              <select
                value={propertyFilter}
                onChange={(e) => {
                  setPropertyFilter(e.target.value);
                  setSelectedId(null);
                }}
              >
                <option value="all">전체 업장 {inbox.properties.length}곳</option>
                {inbox.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={14} />
            </label>
          )}
          <label className="rv-select">
            <span className="pm-sr">채널</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value as ChannelId | "all")}>
              <option value="all">전체 채널</option>
              {channels.map((c) => (
                <option key={c.channel} value={c.channel}>
                  {c.name}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={14} />
          </label>
          <label className="rv-select">
            <span className="pm-sr">정렬</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="latest">최신순</option>
              <option value="low">별점 낮은순</option>
            </select>
            <Icon name="chevronDown" size={14} />
          </label>
        </div>
      </div>

      <div className={cx("rv-panes", mobileDetail && "show-detail")}>
        <ul className="rv-list" aria-label="리뷰 목록">
          {list.length === 0 && (
            <li className="rv-empty">
              <Icon name="check" size={22} />
              <p>이 분류에는 리뷰가 없어요.</p>
            </li>
          )}
          {list.map((r) => {
            const answered = isAnswered(r);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className={cx("rv-item", selected?.id === r.id && "is-on")}
                  onClick={() => select(r.id)}
                >
                  {propertyOf(r) && <span className="rv-item__property">{propertyOf(r)}</span>}
                  <span className="rv-item__top">
                    <ChannelChip channel={r.channel} name={conn(r.channel).name} />
                    <Stars rating={r.rating} />
                    <span className="rv-item__when num">{r.postedAt.slice(5, 10).replace("-", ".")}</span>
                  </span>
                  <span className="rv-item__body">{r.body}</span>
                  <span className="rv-item__foot">
                    {answered ? (
                      <Badge tone="ok">답글 완료</Badge>
                    ) : (
                      r.needsReview && <Badge tone="warn">확인 필요</Badge>
                    )}
                    {r.photos.length > 0 && (
                      <span className="rv-item__photos">
                        <Icon name="photo" size={14} /> {r.photos.length}
                      </span>
                    )}
                    <span className="rv-item__room">{r.roomType}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {selected && (
          <ReviewDetail
            key={selected.id}
            review={selected}
            propertyName={propertyOf(selected)}
            channel={conn(selected.channel)}
            state={stateOf(selected)}
            answered={isAnswered(selected)}
            onBack={() => setMobileDetail(false)}
            onDraft={(draft) => setLocal((prev) => ({ ...prev, [selected.id]: { ...stateOf(selected), draft } }))}
            onPost={() => post(selected)}
            onRedraft={actions ? () => redraft(selected) : undefined}
            pending={pending}
          />
        )}
      </div>

      {toast && (
        <div className={cx("rv-toast", toast.bad && "is-bad")} role={toast.bad ? "alert" : "status"}>
          <Icon name={toast.bad ? "alert" : "check"} size={16} />
          {toast.text}
        </div>
      )}
    </div>
  );
}

interface ReviewDetailProps {
  review: GuestReview;
  /** 통합 리뷰함에서만 */
  propertyName?: string;
  channel: ChannelConnection;
  state: LocalState;
  answered: boolean;
  onBack: () => void;
  onDraft: (draft: string) => void;
  onPost: () => void;
  onRedraft?: () => void;
  pending?: boolean;
}

function ReviewDetail({
  review,
  propertyName,
  channel,
  state,
  answered,
  onBack,
  onDraft,
  onPost,
  onRedraft,
  pending,
}: ReviewDetailProps) {
  const reply = state.posted?.text ?? review.reply;
  const edited = state.draft !== review.aiDraft;

  return (
    <article className="rv-detail" aria-label="리뷰 상세">
      <button type="button" className="rv-detail__back" onClick={onBack}>
        <Icon name="chevronLeft" size={16} /> 목록
      </button>

      {propertyName && <p className="rv-detail__property">{propertyName}</p>}
      <header className="rv-detail__head">
        <ChannelChip channel={review.channel} name={channel.name} />
        <Stars rating={review.rating} />
        <span className="rv-detail__author">{review.author}</span>
        <span className="rv-detail__meta">
          <span>{review.roomType}</span>
          <span>
            투숙 <span className="num">{review.stayDate.slice(5).replace("-", ".")}</span>
          </span>
          <span>
            작성 <span className="num">{review.postedAt.slice(5).replace("-", ".")}</span>
          </span>
        </span>
      </header>

      <p className="rv-detail__body">{review.body}</p>
      {review.photos.length > 0 && (
        <div className="rv-detail__photos">
          {review.photos.map((p) => (
            <ReviewPhoto key={p} photo={p} alt="고객 첨부 사진" />
          ))}
        </div>
      )}

      {answered && reply ? (
        <section className="rv-reply rv-reply--done">
          <p className="rv-reply__label">
            <Badge tone="ok">{state.posted?.via === "copy" ? "복사해서 게시함" : "게시 완료"}</Badge>
            <span>사장님 답글</span>
          </p>
          <p className="rv-reply__text">{reply}</p>
        </section>
      ) : (
        <section className="rv-reply">
          <div className="rv-reply__label">
            <h3 className="rv-reply__title">답글 초안</h3>
            {review.draftGenerator === "template" && <span className="rv-reply__kind">기본 문장</span>}
            {edited && <Badge tone="info">수정함</Badge>}
          </div>

          {review.needsReview && (
            <p className="rv-reply__warn">
              <Icon name="alert" size={15} />
              실명·연락처가 들어 있는 리뷰라 자동 게시에서 빠졌어요. 내용을 확인하고 직접 게시해 주세요.
            </p>
          )}

          {review.aiKeywords.length > 0 && (
            <div className="rv-reply__memo">
              <span>반영한 키워드</span>
              {review.aiKeywords.map((k) => (
                <Tag key={k}>{k}</Tag>
              ))}
            </div>
          )}
          {review.draftGenerator === "template" && (
            <p className="rv-reply__hint">말투 설정으로 만든 기본 답글이에요. 리뷰 내용에 맞게 다듬어 주세요.</p>
          )}

          <textarea
            className="rv-reply__input"
            value={state.draft}
            onChange={(e) => onDraft(e.target.value)}
            rows={8}
            aria-label="답글 내용"
          />

          <div className="rv-reply__actions">
            <span className="rv-reply__count num">{state.draft.length}자</span>
            {edited && (
              <PmButton variant="quiet" size="sm" icon="undo" onClick={() => onDraft(review.aiDraft)}>
                초안으로 되돌리기
              </PmButton>
            )}
            {onRedraft && (
              <PmButton variant="quiet" size="sm" icon="sync" onClick={onRedraft} disabled={pending}>
                다시 쓰기
              </PmButton>
            )}
            <span className="rv-reply__spacer" />
            {channel.replyMode === "api" ? (
              <PmButton variant="primary" icon="check" onClick={onPost} disabled={!state.draft.trim() || pending}>
                {channel.name}에 게시하기
              </PmButton>
            ) : (
              <PmButton variant="primary" icon="copy" onClick={onPost} disabled={!state.draft.trim() || pending}>
                복사하고 게시 완료로 표시
              </PmButton>
            )}
          </div>
          {channel.replyMode === "copy" && (
            <p className="rv-reply__hint">
              {josa(channel.name, "은/는")} 아직 자동 게시를 지원하지 않아 파트너센터에 붙여넣어야 해요. 누르면 답글을
              복사하고 파트너센터를 새 창으로 열어요.
            </p>
          )}
        </section>
      )}
    </article>
  );
}
