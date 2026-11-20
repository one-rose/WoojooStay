"use client";

import { useState, useTransition } from "react";
import type { ActionResult, ReplySettings } from "@/core";
import { cx } from "@/shared";
import { ApplyToDialog, Card, Field, Icon, PageHead, PmButton, Switch } from "../../components";
import "./reviews.css";

const SAMPLE_REVIEW = "체크인이 빨랐고 직원분이 친절했어요. 다만 아침 엘리베이터 대기가 길었습니다.";

/** 업장별 톤앤매너 (F1-04) · 자동 응대 (F1-08) */
interface ReplySettingsScreenProps {
  initial: ReplySettings;
  /** 실서버 저장. applyTo: 같은 설정을 함께 저장할 다른 업장. 없으면 화면만 동작하는 시안 */
  onSave?: (s: ReplySettings, applyTo?: string[]) => Promise<ActionResult>;
  /** 함께 적용할 수 있는 다른 업장 (사장님·매니저인 업장) */
  otherProperties?: readonly { id: string; name: string }[];
}

export function ReplySettingsScreen({ initial, onSave, otherProperties = [] }: ReplySettingsScreenProps) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyIds, setApplyIds] = useState<string[]>([]);
  const save = (applyTo?: string[]) =>
    start(async () => {
      setApplyOpen(false);
      const also = applyTo?.length
        ? ` 업장 ${applyTo.length}곳에도 같은 말투로 저장했어요 (서명은 업장마다 그대로).`
        : "";
      if (!onSave) {
        setSavedJson(JSON.stringify(s));
        return setMsg({ ok: true, text: `저장했어요 (시안).${also}` });
      }
      const r = await onSave(s, applyTo);
      if (r.ok) setSavedJson(JSON.stringify(s));
      setMsg(
        r.ok ? { ok: true, text: `저장했어요. 다음 답글 초안부터 반영돼요.${also}` } : { ok: false, text: r.message },
      );
    });
  const set = <K extends keyof ReplySettings>(k: K, v: ReplySettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const auto = s.autoReply;
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial));
  const dirty = JSON.stringify(s) !== savedJson;

  const preview =
    s.tone === "polite"
      ? `소중한 후기 남겨주셔서 감사합니다. 빠른 체크인과 직원 응대를 좋게 봐주셔서 기쁩니다. 말씀 주신 아침 엘리베이터 대기는 바로 점검하겠습니다. ${s.mustInclude}\n\n${s.signature}`
      : `좋은 후기 고마워요! 체크인이랑 직원 응대 마음에 드셨다니 저희도 신나요. 아침 엘리베이터는 더 빨리 다니도록 바로 손볼게요. ${s.mustInclude}\n\n${s.signature}`;

  return (
    <div className="rs">
      <PageHead
        title="답글 말투 설정"
        desc="여기 설정이 모든 답글 초안에 반영돼요. 바꾸면 오른쪽 미리보기에서 바로 확인할 수 있어요."
        actions={
          <PmButton href="/app/reviews" icon="chevronLeft">
            리뷰 목록
          </PmButton>
        }
      />
      <div className="rs-grid">
        <div className="rs-col">
          <Card title="말투">
            <Field label="기본 말투">
              <div className="pm-choice">
                <label>
                  <input
                    type="radio"
                    name="tone"
                    checked={s.tone === "polite"}
                    onChange={() => set("tone", "polite")}
                  />{" "}
                  정중하게
                </label>
                <label>
                  <input
                    type="radio"
                    name="tone"
                    checked={s.tone === "friendly"}
                    onChange={() => set("tone", "friendly")}
                  />{" "}
                  친근하게
                </label>
              </div>
            </Field>
            <Field label="서명" hint="답글 맨 끝에 붙어요">
              <input className="pm-input" value={s.signature} onChange={(e) => set("signature", e.target.value)} />
            </Field>
            <Field label="꼭 넣을 문장">
              <input className="pm-input" value={s.mustInclude} onChange={(e) => set("mustInclude", e.target.value)} />
            </Field>
            <Field label="쓰지 않을 단어" hint="쉼표로 나눠 적어요. 이 단어가 들어간 초안은 다시 써요.">
              <input className="pm-input" value={s.banned} onChange={(e) => set("banned", e.target.value)} />
            </Field>
          </Card>

          <Card
            title="24시간 자동 응대"
            meta="조건에 맞는 새 리뷰는 확인 없이 바로 등록"
            action={
              <Switch
                checked={auto.enabled}
                label="자동 응대"
                onChange={(v) => set("autoReply", { ...auto, enabled: v })}
              />
            }
          >
            {!auto.enabled && <p className="rs-auto__off">자동 응대를 켜면 별점과 시간을 고를 수 있어요.</p>}
            <fieldset className="rs-auto" disabled={!auto.enabled}>
              <Field label="자동으로 답할 별점">
                <select
                  className="pm-input"
                  value={auto.minRating}
                  onChange={(e) => set("autoReply", { ...auto, minRating: Number(e.target.value) })}
                >
                  <option value={5}>5점만</option>
                  <option value={4}>4점 이상</option>
                </select>
              </Field>
              <Field label="게시 시간">
                <div className="pm-choice">
                  <label>
                    <input
                      type="radio"
                      name="autoHours"
                      checked={auto.hours === "always"}
                      onChange={() => set("autoReply", { ...auto, hours: "always" })}
                    />{" "}
                    24시간
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="autoHours"
                      checked={auto.hours === "daytime"}
                      onChange={() => set("autoReply", { ...auto, hours: "daytime" })}
                    />{" "}
                    오전 9시 ~ 밤 9시
                  </label>
                </div>
              </Field>
            </fieldset>
            <p className="rs-note">
              <Icon name="alert" size={14} /> 별점 3점 이하, 실명·연락처가 든 리뷰는 자동 게시하지 않고 &lsquo;확인
              필요&rsquo;로 남기고 알림을 보내요. 자동 응대는 자동 등록이 되는 채널(호텔스닷컴 등)에서만 동작하고, 다른
              채널은 초안만 만들어 둬요.
            </p>
          </Card>

          {/* 저장 바 — 폼 아래에 붙어 따라오는 한 줄 (요금·재고 저장 바와 같은 모양, D-15) */}
          <div className={cx("rs-savebar", dirty && "is-dirty")} role="region" aria-label="저장">
            <p>
              {msg ? (
                <span className={msg.ok ? "rs-saved" : "pm-error"} role={msg.ok ? "status" : "alert"}>
                  {msg.text}
                </span>
              ) : dirty ? (
                <strong>저장하지 않은 변경이 있어요</strong>
              ) : (
                <span className="rs-savebar__idle">바꾸면 오른쪽 미리보기에 바로 보여요</span>
              )}
            </p>
            {otherProperties.length > 0 && (
              <PmButton
                onClick={() => {
                  setApplyIds(otherProperties.map((p) => p.id));
                  setApplyOpen(true);
                }}
                disabled={pending}
              >
                다른 업장에도 적용
              </PmButton>
            )}
            <PmButton variant="primary" onClick={() => save()} disabled={pending || (!dirty && !!onSave)}>
              {pending ? "저장 중…" : "설정 저장"}
            </PmButton>
          </div>
        </div>

        <Card title="미리보기" className="rs-preview">
          <p className="rs-preview__review">
            <span className="rs-preview__label">예시 리뷰 (별점 4)</span>
            {SAMPLE_REVIEW}
          </p>
          <p className="rs-preview__reply">{preview}</p>
          {applyOpen && (
            <ApplyToDialog
              title="같은 말투를 다른 업장에도"
              desc="말투·꼭 넣을 문구·금지어·자동 응대를 이 업장과 고른 업장에 함께 저장해요. 서명은 업장 이름이 들어가서 업장마다 그대로 둬요."
              properties={otherProperties}
              selected={applyIds}
              onChange={setApplyIds}
              pending={pending}
              onClose={() => setApplyOpen(false)}
              onApply={() => save(applyIds)}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
