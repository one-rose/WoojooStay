"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChannelConnection, ChannelId, OnboardingActions, PlanOption, PropertyType } from "@/core";
import { cx, formatNumber } from "@/shared";
import { Logo } from "@/ui/brand";
import { Badge, ChannelChip, Field, Icon, PmButton } from "../../components";
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
}

/** 가입 직후 온보딩 — 업장 등록(F0-02) · 채널 연동(F0-04) · 구독 선택(F0-08) */
export function OnboardingScreen({
  channels,
  plans,
  samplePrices = true,
  actions,
  initialStep = 0,
}: OnboardingScreenProps) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [type, setType] = useState<PropertyType>("hotel");
  const [bizChecked, setBizChecked] = useState(false);
  const [bizStatus, setBizStatus] = useState<string>("");
  const [linked, setLinked] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: actions ? "" : "스테이 오르빗 을지로",
    address: actions ? "" : "서울 중구 을지로 OO길 12",
    rooms: actions ? "" : "42",
    bizNo: actions ? "" : "123-45-67891",
    ownerName: actions ? "" : "정현",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [openChannel, setOpenChannel] = useState<ChannelId | null>(null);
  const [cred, setCred] = useState({ loginId: "", password: "" });
  const [fetched, setFetched] = useState(0);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (k === "bizNo") {
      setBizChecked(false);
      setBizStatus("");
    }
  };

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
        setFetched((n) => n + r.data.newReviews);
      }
      setLinked((l) => [...l, channel]);
      setOpenChannel(null);
      setCred({ loginId: "", password: "" });
    });
  const [consent, setConsent] = useState(false);
  const [picked, setPicked] = useState<string[]>(["review"]);
  const sum = plans.filter((p) => picked.includes(p.id)).reduce((s, p) => s + p.price, 0);

  /** 고른 서비스로 체험 시작 */
  const start2 = () =>
    start(async () => {
      setError(null);
      if (actions) {
        for (const id of picked) {
          const r = await actions.setPlan(id, true);
          if (!r.ok) return setError(r.message);
        }
      }
      setStep(3);
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
            <p className="ob-desc">업장마다 채널·구독·데이터를 따로 관리해요.</p>
            <Field label="업장 이름" required>
              <input className="pm-input" value={form.name} onChange={set("name")} />
            </Field>
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
              <Field label="주소" required>
                <input className="pm-input" value={form.address} onChange={set("address")} />
              </Field>
              <Field label="객실 수" required>
                <input className="pm-input num" inputMode="numeric" value={form.rooms} onChange={set("rooms")} />
              </Field>
            </div>
            <Field
              label="사업자등록번호"
              required
              hint={bizChecked ? undefined : "국세청에서 휴·폐업 여부를 확인해요."}
            >
              <div className="au-inline">
                <input className="pm-input num" value={form.bizNo} onChange={set("bizNo")} placeholder="000-00-00000" />
                <PmButton variant={bizChecked ? "ghost" : "navy"} onClick={checkBiz} disabled={pending}>
                  {bizChecked ? "확인됨" : "확인"}
                </PmButton>
              </div>
              {bizChecked && bizStatus && (
                <p className="ob-ok" role="status">
                  <Icon name="check" size={14} /> {bizStatus}
                </p>
              )}
            </Field>
            <Field label="대표자 이름" required>
              <input className="pm-input" value={form.ownerName} onChange={set("ownerName")} />
            </Field>
            {error && (
              <p className="pm-error" role="alert">
                {error}
              </p>
            )}
            <div className="ob-actions">
              <span />
              <PmButton
                variant="primary"
                onClick={saveProperty}
                disabled={!bizChecked || pending || !form.name || !form.address || !form.rooms || !form.ownerName}
              >
                {pending ? "저장 중…" : "다음"}
              </PmButton>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="ob-panel ob-panel--wide">
            <h1>쓰고 있는 예약 채널을 연결해 주세요</h1>
            <p className="ob-desc">
              지금 쓰는 파트너센터 계정 그대로 연결해요. 연결하면 최근 90일 예약·리뷰·정산을 한 번에 가져와요. 지금 안
              해도 나중에 설정 &gt; 채널 연동에서 연결할 수 있어요.
            </p>
            <label className="ob-consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                <strong>(필수) 채널 계정 정보 위탁·수집 동의</strong>
                <small>
                  연결한 채널의 예약·리뷰·정산 정보를 우주스테이가 대신 가져오는 데 동의해요. 언제든 연결을 끊을 수
                  있어요.
                </small>
              </span>
            </label>
            <ul className="ob-channels">
              {channels.map((c) => {
                const on = linked.includes(c.channel);
                return (
                  <li key={c.channel} className={cx(on && "is-on")}>
                    <ChannelChip channel={c.channel} name={c.name} />
                    {on ? (
                      <Badge tone="ok" dot>
                        연결됨
                      </Badge>
                    ) : actions ? (
                      <PmButton size="sm" onClick={() => setOpenChannel(c.channel)} disabled={!consent}>
                        연결
                      </PmButton>
                    ) : (
                      <PmButton size="sm" onClick={() => setLinked((l) => [...l, c.channel])} disabled={!consent}>
                        연결
                      </PmButton>
                    )}
                    {openChannel === c.channel && (
                      <form
                        className="ob-login"
                        onSubmit={(e) => {
                          e.preventDefault();
                          connect(c.channel);
                        }}
                      >
                        <input
                          className="pm-input"
                          placeholder={`${c.name} 파트너센터 아이디`}
                          value={cred.loginId}
                          onChange={(e) => setCred((x) => ({ ...x, loginId: e.target.value }))}
                          autoComplete="off"
                        />
                        <input
                          className="pm-input"
                          type="password"
                          placeholder="비밀번호"
                          value={cred.password}
                          onChange={(e) => setCred((x) => ({ ...x, password: e.target.value }))}
                          autoComplete="off"
                        />
                        <PmButton
                          type="submit"
                          size="sm"
                          variant="navy"
                          disabled={pending || !cred.loginId || !cred.password}
                        >
                          {pending ? "확인 중…" : "로그인하고 연결"}
                        </PmButton>
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
            {fetched > 0 && <p className="ob-ok">리뷰 {fetched}건을 가져와 답글 초안을 만들었어요.</p>}
            <div className="ob-actions">
              {actions ? (
                <span />
              ) : (
                <PmButton variant="ghost" onClick={() => setStep(0)}>
                  이전
                </PmButton>
              )}
              {linked.length === 0 ? (
                <PmButton variant="quiet" onClick={() => setStep(2)}>
                  나중에 연결할게요
                </PmButton>
              ) : (
                <PmButton variant="primary" onClick={() => setStep(2)}>
                  {linked.length}개 연결하고 다음
                </PmButton>
              )}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="ob-panel ob-panel--wide">
            <h1>필요한 서비스만 골라 쓰세요</h1>
            <p className="ob-desc">
              첫 달은 무료예요. 체험이 끝나기 3일 전에 알려드려요.
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
              {plans.map((p) => {
                const on = picked.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className={cx("ob-plan", on && "is-on", !p.available && "is-off")}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!p.available}
                        onChange={() => setPicked((x) => (on ? x.filter((i) => i !== p.id) : [...x, p.id]))}
                      />
                      <span className="ob-plan__stage">{p.stage}</span>
                      <strong>{p.name}</strong>
                      <small>{p.desc}</small>
                      <span className="ob-plan__price num">
                        {p.available ? (
                          <>
                            ₩{formatNumber(p.price)}
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
              <PmButton variant="ghost" onClick={() => setStep(1)}>
                이전
              </PmButton>
              <span className="ob-sum num">
                체험 후 월 <strong>₩{formatNumber(sum)}</strong>
              </span>
              <PmButton variant="primary" onClick={start2} disabled={picked.length === 0 || pending}>
                {pending ? "시작하는 중…" : "무료로 시작하기"}
              </PmButton>
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
              {linked.length > 0
                ? `채널 ${linked.length}곳에서 데이터를 가져오는 중이에요. 보통 10분 안에 끝나고, 끝나면 알림으로 알려드릴게요.`
                : "채널은 설정 > 채널 연동에서 언제든 연결할 수 있어요. 연결하면 리뷰·매출을 바로 가져와요."}
            </p>
            <PmButton
              variant="primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await actions?.finish?.();
                  router.push("/app");
                })
              }
            >
              홈으로 가기
            </PmButton>
          </section>
        )}
      </main>
    </div>
  );
}
