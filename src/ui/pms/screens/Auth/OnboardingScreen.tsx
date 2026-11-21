"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChannelConnection, ChannelId, GuestReview, OnboardingActions, PlanOption, PropertyType } from "@/core";
import { cx, formatWon, plainList } from "@/shared";
import { Logo } from "@/ui/brand";
import { Badge, ChannelChip, Field, Icon, Stars } from "../../components";
import { AxButton, AxTextField } from "../../components/Astryx";
import "./auth.css";

const STEPS = ["업장 정보", "채널 연결", "서비스 선택", "시작하기"];
const TYPES: { id: PropertyType; label: string }[] = [
  { id: "hotel", label: "호텔" },
  { id: "motel", label: "모텔" },
  { id: "pension", label: "펜션" },
  { id: "guesthouse", label: "게스트하우스" },
];

interface OnboardingScreenProps {
  channels: readonly ChannelConnection[];
  plans: readonly PlanOption[];
  /** 요금이 아직 예시 값인지 (실서버 상품을 못 불러왔을 때) */
  samplePrices?: boolean;
  /** 없으면 화면만 동작하는 시안 */
  actions?: OnboardingActions;
  /** 업장을 이미 등록하고 이어서 하는 경우 1 (채널 연결부터) */
  initialStep?: number;
  /**
   * 속한 업장이 하나도 없는 사람 — 업장 등록 폼 아래에 "초대받아 일하시나요?" 작은 안내
   * (직원이었다가 빠진 사람도 길을 찾게)
   */
  intro?: boolean;
  /** 다른 번호로 로그인 — 있으면 초대 안내에 로그아웃 버튼 */
  logoutPath?: string;
  /** 대표자 이름 칸에 미리 채울 이름 (가입한 이름) */
  ownerName?: string;
  /** 무료 체험 일수 (API trialDays, 없으면 30) */
  trialDays?: number;
  /** 체험 모드 — 첫 가치 미리보기에 쓸 예시 리뷰 */
  demoSample?: GuestReview | null;
}

/** 가입 직후 온보딩 — 업장 등록(F0-02) · 채널 연동(F0-04) · 구독 선택(F0-08) */
export function OnboardingScreen({
  channels,
  plans,
  samplePrices = true,
  actions,
  initialStep = 0,
  intro = false,
  logoutPath,
  ownerName = "",
  trialDays = 30,
  demoSample = null,
}: OnboardingScreenProps) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  // 숙박 유형은 미리 고르지 않는다 (잘못 고른 채 지나가지 않게)
  const [type, setType] = useState<PropertyType | null>(actions ? null : "hotel");
  const [bizChecked, setBizChecked] = useState(false);
  const [bizStatus, setBizStatus] = useState<string>("");
  const [linked, setLinked] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: actions ? "" : "스테이 오르빗 을지로",
    address: actions ? "" : "서울 중구 을지로 OO길 12",
    rooms: actions ? "" : "42",
    bizNo: actions ? "" : "123-45-67891",
    ownerName: actions ? ownerName : "정현",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [openChannel, setOpenChannel] = useState<ChannelId | null>(null);
  const [cred, setCred] = useState({ loginId: "", password: "" });
  const [showHelp, setShowHelp] = useState(false);
  /** 첫 가치 — 답글 기다리는 리뷰 수와 초안 한 건 */
  const [drafts, setDrafts] = useState<{ count: number; sample: GuestReview | null } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (k === "bizNo") {
      setBizChecked(false);
      setBizStatus("");
    }
  };

  /** 아스트릭스 입력창은 값만 넘긴다 */
  const setV = (k: keyof typeof form) => (v: string) =>
    set(k)({ target: { value: v } } as React.ChangeEvent<HTMLInputElement>);

  const checkBiz = () =>
    start(async () => {
      setError(null);
      if (!actions) {
        setBizStatus("국세청 확인: 계속사업자 (예시)");
        return setBizChecked(true);
      }
      const r = await actions.checkBizNo(form.bizNo);
      if (!r.ok) return setError(r.message);
      if (r.data.status === "ACTIVE") {
        setBizChecked(true);
        setBizStatus("국세청 확인: 영업 중인 사업자예요");
      } else
        setError(r.data.status === "CLOSED" ? "휴업 또는 폐업한 사업자예요." : "사업자등록번호가 올바르지 않아요.");
    });

  const saveProperty = () =>
    start(async () => {
      setError(null);
      if (!type) return setError("숙박 유형을 골라 주세요.");
      if (actions) {
        const r = await actions.createProperty({
          name: form.name,
          type,
          address: form.address,
          rooms: Number(form.rooms),
          bizNo: form.bizNo,
          ownerName: form.ownerName,
        });
        if (!r.ok) return setError(r.message);
      }
      setStep(1);
    });

  const connect = (channel: ChannelId) =>
    start(async () => {
      setError(null);
      if (actions) {
        const r = await actions.connectChannel(channel, cred.loginId, cred.password);
        if (!r.ok) return setError(r.message);
        if (actions.previewDrafts) {
          const p = await actions.previewDrafts();
          if (p.ok) setDrafts(p.data);
        }
      } else if (demoSample) {
        setDrafts((d) => ({ count: (d?.count ?? 0) + 4, sample: demoSample }));
      }
      setLinked((l) => [...l, channel]);
      setOpenChannel(null);
      setShowHelp(false);
      setCred({ loginId: "", password: "" });
    });
  const [picked, setPicked] = useState<string[]>(["review"]);
  const sum = plans.filter((p) => picked.includes(p.id)).reduce((s, p) => s + p.price, 0);
  const freeLabel = trialDays === 30 ? "첫 달 무료" : `${trialDays}일 무료`;
  /** 서비스 카드 위 작은 글자 — 내부 단계 이름 대신 */
  const planNote = (p: PlanOption, i: number) => (!p.available ? "준비 중" : i === 0 ? "추천" : freeLabel);

  /** 고른 서비스로 체험 시작 */
  const start2 = () =>
    start(async () => {
      setError(null);
      if (actions) {
        for (const id of picked) {
          const r = await actions.setPlan(id, true);
          if (!r.ok) return setError(r.message);
        }
        // 업장을 등록하면 기본 서비스(리뷰·매출장부) 체험이 함께 켜진다 — 고르지 않은 것은 끄고 시작해
        // 구독 화면의 월 합계가 여기서 보여 드린 금액과 같게
        for (const p of plans.filter((x) => !picked.includes(x.id) && x.available)) {
          const r = await actions.setPlan(p.id, false);
          if (!r.ok) return setError(r.message);
        }
      }
      setStep(3);
    });

  const finish = (to: string) =>
    start(async () => {
      await actions?.finish?.();
      router.push(to);
    });

  return (
    <div className="ob">
      <header className="ob-top">
        <Logo className="ob-top__logo" />
        <ol className="ob-steps">
          {STEPS.map((s, i) => (
            <li key={s} className={cx(i === step && "is-on", i < step && "is-done")}>
              <span className="num">{i < step ? <Icon name="check" size={13} /> : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </header>

      <main className="ob-main">
        {step === 0 && (
          <section className="ob-panel">
            <h1>운영하는 숙소를 알려 주세요</h1>
            <p className="ob-desc">업장마다 채널·구독·데이터를 따로 관리해요. 여러 곳이면 하나씩 등록하면 돼요.</p>
            <AxTextField label="업장 이름" value={form.name} onChange={setV("name")} />
            <Field label="숙박 유형" required hint="유형에 맞는 화면을 먼저 보여드려요 (모텔은 대실 집계 등)">
              <div className="pm-choice">
                {TYPES.map((t) => (
                  <label key={t.id}>
                    <input type="radio" name="type" checked={type === t.id} onChange={() => setType(t.id)} />
                    {t.label}
                  </label>
                ))}
              </div>
            </Field>
            <div className="ob-row">
              <AxTextField label="주소" value={form.address} onChange={setV("address")} />
              <AxTextField label="객실 수" inputMode="numeric" value={form.rooms} onChange={setV("rooms")} />
            </div>
            <div>
              <div className="au-inline">
                <AxTextField
                  label="사업자등록번호"
                  hint={bizChecked ? undefined : "국세청에서 휴·폐업 여부를 확인해요."}
                  inputMode="numeric"
                  value={form.bizNo}
                  onChange={setV("bizNo")}
                  placeholder="000-00-00000"
                />
                <AxButton variant={bizChecked ? "ghost" : "navy"} onClick={checkBiz} disabled={pending}>
                  {bizChecked ? "확인됨" : "확인"}
                </AxButton>
              </div>
              {bizChecked && bizStatus && (
                <p className="ob-ok" role="status">
                  <Icon name="check" size={14} /> {bizStatus}
                </p>
              )}
            </div>
            <AxTextField
              label="대표자 이름"
              hint={ownerName ? "가입한 이름을 넣어 뒀어요. 다르면 고쳐 주세요." : undefined}
              value={form.ownerName}
              onChange={setV("ownerName")}
            />
            {error && (
              <p className="pm-error" role="alert">
                {error}
              </p>
            )}
            <div className="ob-actions">
              <span />
              <AxButton
                variant="primary"
                onClick={saveProperty}
                disabled={
                  !bizChecked || pending || !type || !form.name || !form.address || !form.rooms || !form.ownerName
                }
              >
                {pending ? "저장 중…" : "다음"}
              </AxButton>
            </div>
            {intro && (
              <div className="ob-invited">
                <p>초대받아 일하시나요? 사장님이 보낸 초대 문자의 링크를 누르면 그 업장으로 바로 들어가요.</p>
                {logoutPath && (
                  <form action={logoutPath} method="post">
                    <button type="submit" className="ob-invited__link">
                      다른 번호로 로그인
                    </button>
                  </form>
                )}
              </div>
            )}
          </section>
        )}

        {step === 1 && (
          <section className="ob-panel ob-panel--wide">
            <h1>쓰고 있는 예약 채널을 연결해 주세요</h1>
            <p className="ob-desc">
              지금 쓰는 파트너센터 아이디·비밀번호 그대로 연결해요. 연결하면 최근 90일 예약·리뷰·정산을 한 번에
              가져오고, 리뷰마다 답글 초안을 만들어 드려요. 나중에 채널 연동 메뉴에서 해도 돼요.
            </p>
            <ul className="ob-channels">
              {channels.map((c) => {
                const on = linked.includes(c.channel);
                const opened = openChannel === c.channel;
                return (
                  <li key={c.channel} className={cx(on && "is-on", opened && "is-open")}>
                    <ChannelChip channel={c.channel} name={c.name} />
                    {on ? (
                      <Badge tone="ok" dot>
                        연결됨
                      </Badge>
                    ) : opened ? (
                      <button type="button" className="ob-login__close" onClick={() => setOpenChannel(null)}>
                        닫기
                      </button>
                    ) : (
                      <AxButton
                        size="sm"
                        onClick={() => {
                          setError(null);
                          setShowHelp(false);
                          setCred({ loginId: "", password: "" });
                          setOpenChannel(c.channel);
                        }}
                      >
                        연결
                      </AxButton>
                    )}
                    {opened && (
                      <form
                        className="ob-login"
                        onSubmit={(e) => {
                          e.preventDefault();
                          connect(c.channel);
                        }}
                      >
                        <div className="ob-login__fields">
                          <input
                            className="pm-input"
                            placeholder={`${c.name} 파트너센터 아이디`}
                            aria-label={`${c.name} 파트너센터 아이디`}
                            value={cred.loginId}
                            onChange={(e) => setCred((x) => ({ ...x, loginId: e.target.value }))}
                            autoComplete="off"
                            autoFocus
                          />
                          <input
                            className="pm-input"
                            type="password"
                            placeholder="비밀번호"
                            aria-label={`${c.name} 파트너센터 비밀번호`}
                            value={cred.password}
                            onChange={(e) => setCred((x) => ({ ...x, password: e.target.value }))}
                            autoComplete="off"
                          />
                          <AxButton
                            type="submit"
                            size="sm"
                            variant="navy"
                            disabled={pending || !cred.loginId || !cred.password}
                          >
                            {pending ? "확인 중…" : "동의하고 연결"}
                          </AxButton>
                        </div>
                        <p className="ob-login__safe">
                          <Icon name="lock" size={14} />
                          비밀번호는 암호화해 보관하고, 예약·리뷰·정산을 가져오는 데만 써요. 언제든 연결을 끊을 수
                          있어요.
                        </p>
                        <p className="ob-login__consent">
                          연결하면 {c.name} 계정 정보 위탁과 예약·리뷰·정산 정보 수집에 동의하는 것으로 봐요.
                        </p>
                        <button type="button" className="ob-login__help" onClick={() => setShowHelp((v) => !v)}>
                          아이디가 기억 안 나요
                        </button>
                        {showHelp && (
                          <p className="ob-login__helptext">
                            {c.name} 파트너센터(사장님용 관리 사이트) 로그인 화면의 &lsquo;아이디 찾기&rsquo;에서 찾을
                            수 있어요. 직원이나 대행사가 계정을 만들었다면 그분께 물어봐 주세요. 찾기 어려우면 이 채널은
                            건너뛰고 나중에 연결해도 돼요.
                          </p>
                        )}
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
            {error && (
              <p className="pm-error" role="alert">
                {error}
              </p>
            )}
            {drafts && drafts.count > 0 && <FirstValue drafts={drafts} channels={channels} />}
            <div className="ob-actions">
              {actions ? (
                <span />
              ) : (
                <AxButton variant="ghost" onClick={() => setStep(0)}>
                  이전
                </AxButton>
              )}
              {linked.length === 0 ? (
                <AxButton variant="quiet" onClick={() => setStep(2)}>
                  나중에 연결할게요
                </AxButton>
              ) : (
                <AxButton variant="primary" onClick={() => setStep(2)}>
                  {linked.length}개 연결하고 다음
                </AxButton>
              )}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="ob-panel ob-panel--wide">
            <h1>필요한 서비스만 골라 쓰세요</h1>
            <p className="ob-desc">
              처음 {trialDays}일은 무료예요. 체험이 끝나기 3일 전에 알려드리고, 카드를 등록하기 전에는 결제되지 않아요.
              {samplePrices && (
                <>
                  {" "}
                  <Badge tone="neutral">표시 금액은 예시예요</Badge>
                </>
              )}
            </p>
            {error && (
              <p className="pm-error" role="alert">
                {error}
              </p>
            )}
            <ul className="ob-plans">
              {plans.map((p, i) => {
                const on = picked.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className={cx("ob-plan", on && "is-on", !p.available && "is-off")}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!p.available}
                        onChange={() => setPicked((x) => (on ? x.filter((id) => id !== p.id) : [...x, p.id]))}
                      />
                      <span className={cx("ob-plan__stage", p.available && i === 0 && "is-pick")}>
                        {planNote(p, i)}
                      </span>
                      <strong>{p.name}</strong>
                      <small>{plainList(p.desc)}</small>
                      <span className="ob-plan__price num">
                        {p.available ? (
                          <>
                            {formatWon(p.price)}
                            <em>/월</em>
                          </>
                        ) : (
                          "준비 중"
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="ob-actions">
              <AxButton variant="ghost" onClick={() => setStep(1)}>
                이전
              </AxButton>
              <span className="ob-sum num">
                체험 뒤 월 <strong>{formatWon(sum)}</strong>
              </span>
              <AxButton variant="primary" onClick={start2} disabled={picked.length === 0 || pending}>
                {pending ? "시작하는 중…" : "무료로 시작하기"}
              </AxButton>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="ob-panel ob-done">
            <span className="ob-done__icon">
              <Icon name="check" size={32} />
            </span>
            <h1>준비가 끝났어요</h1>
            <p className="ob-desc">
              {drafts && drafts.count > 0
                ? `리뷰 ${drafts.count}건에 답글 초안을 써 뒀어요. 읽어 보고 게시만 하면 돼요.`
                : linked.length > 0
                  ? `채널 ${linked.length}곳에서 데이터를 가져오는 중이에요. 보통 10분 안에 끝나고, 끝나면 알림으로 알려드릴게요.`
                  : "채널 연동 메뉴에서 언제든 연결할 수 있어요. 연결하면 리뷰·매출을 바로 가져와요."}
            </p>
            {drafts && drafts.count > 0 ? (
              <div className="ob-done__actions">
                <AxButton variant="brand" disabled={pending} onClick={() => finish("/app/reviews")}>
                  답글 초안 {drafts.count}건 확인하기
                </AxButton>
                <button type="button" className="ob-invited__link" onClick={() => finish("/app")}>
                  홈으로 가기
                </button>
              </div>
            ) : (
              <AxButton variant="brand" disabled={pending} onClick={() => finish("/app")}>
                홈으로 가기
              </AxButton>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

/** 채널 연결 직후 — 실제로 가져온 리뷰 한 건과 그 답글 초안 */
function FirstValue({
  drafts,
  channels,
}: {
  drafts: { count: number; sample: GuestReview | null };
  channels: readonly ChannelConnection[];
}) {
  const s = drafts.sample;
  const name = s ? (channels.find((c) => c.channel === s.channel)?.name ?? s.channel) : "";
  return (
    <section className="ob-value" aria-label="가져온 리뷰와 답글 초안">
      <h2>
        리뷰 <span className="num">{drafts.count}</span>건을 가져와 답글 초안을 써 뒀어요
      </h2>
      {s && (
        <div className="ob-value__pair">
          <div className="ob-value__review">
            <p className="ob-value__meta">
              <ChannelChip channel={s.channel} name={name} />
              <Stars rating={s.rating} />
              <span>{s.author}</span>
            </p>
            <p className="ob-value__body">{s.body}</p>
          </div>
          <div className="ob-value__draft">
            <p className="ob-value__label">답글 초안</p>
            <p className="ob-value__text">{s.aiDraft}</p>
          </div>
        </div>
      )}
      <p className="ob-value__foot">마지막 단계에서 바로 확인하고 게시할 수 있어요.</p>
    </section>
  );
}
