"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { clearReplyDraft, loadReplyDraft, saveReplyDraft } from "./reply-drafts";
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
  /** 처음 열 분류 (?tab=low — 전체 현황·홈·알림의 "낮은 별점 리뷰 보기") */
  initialTab?: string | null;
}

const TABS: readonly { id: ReviewTab; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "unanswered", label: "미답변" },
  { id: "low", label: "낮은 별점" },
  { id: "positive", label: "긍정" },
  { id: "improve", label: "개선요청" },
];

type Sort = "latest" | "low";

interface LocalState {
  draft: string;
  /** copyTo: 복사 게시면 파트너센터 주소 (창이 안 열렸을 때 다시 열기) */
  posted?: { text: string; via: "api" | "copy"; copyTo?: string | null };
}

const isTab = (v: string | null | undefined): v is ReviewTab => !!v && TABS.some((t) => t.id === v);

/** 첫 답글 안내를 닫았는지 (이 브라우저) */
const GUIDE_KEY = "uz:review-guide-closed";

/** 연결이 끊긴 채널의 리뷰도 보이도록 — 채널 정보가 없으면 복사 게시로 본다 */
const fallbackChannel = (id: ChannelId): ChannelConnection => ({
  channel: id,
  name: id,
  replyMode: "copy",
  status: "error",
  lastSyncedAt: "-",
});

type Toast = { text: string; bad: boolean };

export function ReviewsScreen({
  reviews,
  channels,
  initialId,
  actions,
  inbox,
  initialProperty,
  initialTab,
}: ReviewsScreenProps) {
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
  const startTab: ReviewTab = isTab(initialTab) ? initialTab : linked ? "all" : "unanswered";
  const [tab, setTabState] = useState<ReviewTab>(startTab);
  /** 방금 답글을 단 리뷰 — 분류에서 빠져도 사장님이 다음으로 넘길 때까지 그 자리에 둔다 */
  const [stickyId, setStickyId] = useState<string | null>(null);
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
  // 낮은 별점으로 열면 별점 낮은 것부터
  const [sort, setSort] = useState<Sort>(startTab === "low" ? "low" : "latest");
  const setTab = (t: ReviewTab) => {
    setTabState(t);
    setStickyId(null);
    if (t === "low") setSort("low");
  };
  const [selectedId, setSelectedId] = useState<string | null>(linked);
  const [mobileDetail, setMobileDetail] = useState(!!linked);
  const [local, setLocal] = useState<Record<string, LocalState>>(() =>
    Object.fromEntries(items.map((r) => [r.id, { draft: r.aiDraft }])),
  );
  const stateOf = (r: GuestReview): LocalState => local[r.id] ?? { draft: r.aiDraft };

  // 고치던 답글을 이 브라우저에서 다시 불러온다 (게시 전 리뷰만) — 저장소는 그린 뒤에 읽는다
  useEffect(() => {
    const t = window.setTimeout(() => {
      const saved: Record<string, LocalState> = {};
      for (const r of items) {
        if (r.status === "posted") continue;
        const text = loadReplyDraft(r.id);
        if (text !== null && text !== r.aiDraft) saved[r.id] = { draft: text };
      }
      if (Object.keys(saved).length > 0)
        setLocal((prev) => {
          const next = { ...prev };
          for (const [id, st] of Object.entries(saved)) if (!prev[id]?.posted) next[id] = st;
          return next;
        });
    }, 0);
    return () => window.clearTimeout(t);
  }, [items]);

  const editDraft = (review: GuestReview, draft: string) => {
    setLocal((prev) => ({ ...prev, [review.id]: { ...(prev[review.id] ?? { draft: review.aiDraft }), draft } }));
    saveReplyDraft(review.id, draft, review.aiDraft);
  };
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
      .filter((r) => r.id === stickyId || matchesReviewTab(effective(r), tab))
      .filter(inProperty)
      .filter((r) => channel === "all" || r.channel === channel);
    return [...filtered].sort((a, b) =>
      sort === "low"
        ? a.rating - b.rating || b.postedAt.localeCompare(a.postedAt)
        : b.postedAt.localeCompare(a.postedAt),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- local · 업장 필터가 바뀌면 다시 계산
  }, [items, tab, channel, sort, local, propertyFilter, stickyId]);

  const selected = list.find((r) => r.id === selectedId) ?? list[0] ?? null;

  const select = (id: string) => {
    if (id !== stickyId) setStickyId(null);
    setSelectedId(id);
    setMobileDetail(true);
  };

  /** 지금 분류·정렬 그대로 다음 리뷰 (방금 답한 리뷰는 목록에서 뺀다) */
  const nextOf = (id: string): GuestReview | null => {
    const i = list.findIndex((r) => r.id === id);
    const rest = list.filter((r) => r.id !== id && !isAnswered(r));
    if (rest.length === 0) return null;
    return rest.find((r) => list.indexOf(r) > i) ?? rest[0];
  };
  const goNext = (id: string) => {
    const n = nextOf(id);
    setStickyId(null);
    setSelectedId(n?.id ?? null);
    if (!n) setMobileDetail(false);
  };

  /** 처음 열었을 때 답글을 기다리던 리뷰 — "N건 중 M건 답했어요" (S2) */
  const [startPending] = useState(() => new Set(reviews.filter((r) => r.status !== "posted").map((r) => r.id)));
  const scopePending = items.filter((r) => startPending.has(r.id) && inProperty(r));
  const doneCount = scopePending.filter((r) => !!local[r.id]?.posted).length;

  // 첫 답글 안내 — 아직 답글을 단 리뷰가 하나도 없고, 닫은 적이 없을 때 한 번
  const [guideClosed, setGuideClosed] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        setGuideClosed(window.localStorage.getItem(GUIDE_KEY) === "1");
      } catch {
        setGuideClosed(false);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  // 채널에 이미 있던 답글은 우리 서비스로 단 답글이 아니므로 빼고 센다
  const neverReplied = !items.some((r) => isAnswered(r) && !r.replyExternal);
  const closeGuide = () => {
    setGuideClosed(true);
    try {
      window.localStorage.setItem(GUIDE_KEY, "1");
    } catch {
      /* 저장 못 해도 이번에는 닫힌다 */
    }
  };

  const forward = (review: GuestReview) =>
    actions?.forward &&
    start(async () => {
      const body = `[리뷰 전달] ${conn(review.channel).name} ★${review.rating} ${review.author}\n${review.body}`;
      const r = await actions.forward!(body, review.propertyId);
      if (!r.ok) return setToast(r.message, true);
      setToast("현장 업무 인수인계에 남겼어요. 다음 근무자가 확인해요.");
    });

  const replace = (r: GuestReview) => setItems((list) => list.map((x) => (x.id === r.id ? r : x)));

  const redraft = (review: GuestReview) =>
    actions &&
    start(async () => {
      const r = await actions.redraft(review.id, review.propertyId);
      if (!r.ok) return setToast(r.message, true);
      replace(r.data.review);
      setLocal((prev) => ({ ...prev, [review.id]: { draft: r.data.review.aiDraft } }));
      clearReplyDraft(review.id);
    });

  const markPosted = (review: GuestReview, text: string, via: "api" | "copy", copyTo?: string | null) => {
    setLocal((prev) => ({ ...prev, [review.id]: { draft: text, posted: { text, via, copyTo } } }));
    clearReplyDraft(review.id);
    // 답한 리뷰에 그대로 머문다 — 다음 리뷰는 사장님이 "다음 리뷰"로 넘긴다
    setStickyId(review.id);
    setSelectedId(review.id);
  };

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
        // 복사 게시는 안내를 리뷰 상세 안에 — 토스트는 바로 게시만
        if (c.replyMode === "api") setToast(`${c.name}에 답글을 게시했어요.`);
        markPosted(review, draft, c.replyMode, r.data.copyTo);
        // 사이드바 미답변 수 · 홈 숫자도 새로
        router.refresh();
      });
      return;
    }
    if (c.replyMode === "api") setToast(`${c.name}에 답글을 게시했어요.`);
    markPosted(review, draft, c.replyMode);
  };

  /*
   * 키보드로 빠르게 (S2, Linear·Gmail 방식): J 다음 · K 이전 · Enter 게시(복사), 답한 리뷰에서 Enter 는 다음 리뷰.
   * 입력칸·선택칸 안에서는 동작하지 않는다.
   */
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  const handleKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.closest("input, textarea, select, [contenteditable=true]") || t.closest("[role=dialog]"))) return;
    if (!selected || list.length === 0) return;
    const i = list.findIndex((r) => r.id === selected.id);
    const key = e.key.toLowerCase();
    if (key === "j" || key === "k") {
      e.preventDefault();
      const n = list[Math.min(list.length - 1, Math.max(0, i + (key === "j" ? 1 : -1)))];
      if (n) {
        if (n.id !== stickyId) setStickyId(null);
        setSelectedId(n.id);
        document.getElementById(`rv-item-${n.id}`)?.scrollIntoView({ block: "nearest" });
      }
    } else if (e.key === "Enter" && t?.tagName !== "BUTTON" && t?.tagName !== "A") {
      e.preventDefault();
      if (isAnswered(selected)) goNext(selected.id);
      else if (!pending) post(selected);
    }
  };
  useEffect(() => {
    keyRef.current = handleKey;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      {!guideClosed && neverReplied && items.length > 0 && (
        <section className="rv-guide" aria-label="첫 답글 안내">
          <div>
            <h2>첫 답글은 낮은 별점부터 달아 보세요</h2>
            <p>
              리뷰마다 답글 초안을 미리 써 뒀어요. 읽어 보고 고칠 곳만 고친 뒤 게시하면 돼요. 자동 등록이 안 되는 채널은
              답글을 복사해 파트너센터에 직접 붙여넣어요.
            </p>
          </div>
          <div className="rv-guide__actions">
            {counts.low > 0 && (
              <PmButton size="sm" onClick={() => setTab("low")}>
                낮은 별점 {counts.low}건 보기
              </PmButton>
            )}
            <PmButton size="sm" variant="quiet" onClick={closeGuide}>
              닫기
            </PmButton>
          </div>
        </section>
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
                  setStickyId(null);
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
            <select
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value as ChannelId | "all");
                setStickyId(null);
              }}
            >
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

      {scopePending.length > 0 && (
        <div className="rv-progress">
          <p>
            답글 기다리던 <b className="num">{scopePending.length}</b>건 중 <b className="num">{doneCount}</b>건
            답했어요
          </p>
          <span className="rv-progress__bar" aria-hidden>
            <span style={{ width: `${(doneCount / scopePending.length) * 100}%` }} />
          </span>
          <p className="rv-progress__keys" aria-label="단축키: J 다음 리뷰, K 이전 리뷰, Enter 게시하고 다음">
            <kbd>J</kbd>
            <kbd>K</kbd> 이동
            <kbd>Enter</kbd> 게시, 한 번 더 누르면 다음
          </p>
        </div>
      )}

      <div className={cx("rv-panes", mobileDetail && "show-detail")}>
        <ul className="rv-list" aria-label="리뷰 목록">
          {list.length === 0 && (
            <li className="rv-empty">
              <Icon name="check" size={22} />
              <p>{tab === "low" ? "답글을 기다리는 낮은 별점 리뷰가 없어요." : "이 분류에는 리뷰가 없어요."}</p>
            </li>
          )}
          {list.map((r) => {
            const answered = isAnswered(r);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  id={`rv-item-${r.id}`}
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
            onDraft={(draft) => editDraft(selected, draft)}
            onPost={() => post(selected)}
            onRedraft={actions ? () => redraft(selected) : undefined}
            onForward={actions?.forward ? () => forward(selected) : undefined}
            onNext={isAnswered(selected) ? () => goNext(selected.id) : undefined}
            nextLabel={nextOf(selected.id) ? "다음 리뷰" : "목록으로"}
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
  /** 현장에 전달 (인수인계) */
  onForward?: () => void;
  /** 답한 뒤 — 지금 분류 그대로 다음 리뷰 */
  onNext?: () => void;
  nextLabel?: string;
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
  onForward,
  onNext,
  nextLabel,
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
          {state.posted?.via === "copy" && (
            <div className="rv-copied" role="status">
              <p>
                <strong>답글을 복사했어요.</strong> {channel.name} 파트너센터에 붙여넣어 주세요. 붙여넣기 전까지는
                손님에게 보이지 않아요.
              </p>
              <div className="rv-copied__actions">
                <PmButton
                  size="sm"
                  icon="copy"
                  onClick={() => void navigator.clipboard?.writeText(reply).catch(() => undefined)}
                >
                  다시 복사
                </PmButton>
                {state.posted.copyTo && (
                  <a className="rv-copied__open" href={state.posted.copyTo} target="_blank" rel="noopener noreferrer">
                    파트너센터 열기
                  </a>
                )}
              </div>
            </div>
          )}
          <p className="rv-reply__label">
            {review.replyExternal && !state.posted ? (
              <>
                <Badge tone="neutral">채널에 이미 있던 답글</Badge>
                <span>우주스테이를 쓰기 전에 단 답글</span>
              </>
            ) : (
              <>
                <Badge tone="ok">{state.posted?.via === "copy" ? "직접 붙여넣기로 답함" : "자동 등록함"}</Badge>
                <span>사장님 답글</span>
              </>
            )}
          </p>
          <p className="rv-reply__text">{reply}</p>
          {onNext && (
            <div className="rv-reply__next">
              <PmButton size="sm" onClick={onNext} icon="chevron">
                {nextLabel ?? "다음 리뷰"}
              </PmButton>
            </div>
          )}
        </section>
      ) : (
        <section className="rv-reply">
          <div className="rv-reply__label">
            <h3 className="rv-reply__title">답글 초안</h3>
            {review.draftGenerator === "template" && <span className="rv-reply__kind">기본 문장</span>}
            {edited && <Badge tone="info">수정함</Badge>}
          </div>

          {review.needsReview && (
            <div className="rv-reply__warn">
              <Icon name="alert" size={15} />
              <div>
                <p>
                  리뷰에 이름이나 전화번호가 들어 있어요. 답글에는 옮겨 적지 말고, 연락 요청은 현장에서 챙기게 전달해
                  주세요. 이 리뷰는 자동 등록하지 않아요.
                </p>
                {onForward && (
                  <PmButton size="sm" icon="door" onClick={onForward} disabled={pending} className="rv-reply__fwd">
                    현장에 전달
                  </PmButton>
                )}
              </div>
            </div>
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
                복사하고 답한 것으로 표시
              </PmButton>
            )}
          </div>
          {channel.replyMode === "copy" && (
            <p className="rv-reply__hint">
              {josa(channel.name, "은/는")} 아직 자동 등록이 안 돼서 파트너센터에 직접 붙여넣어야 해요. 누르면 답글을
              복사하고 파트너센터를 새 창으로 열어요.
            </p>
          )}
        </section>
      )}
    </article>
  );
}
