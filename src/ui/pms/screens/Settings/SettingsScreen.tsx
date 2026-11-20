"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  AccountMember,
  AccountRole,
  ActionResult,
  ChannelAccount,
  ChannelId,
  NoticeKind,
  NoticeSetting,
  PropertyType,
  SettingsActions,
  SettingsData,
} from "@/core";
import { cx, formatWon, josa, plainList } from "@/shared";
import {
  ApplyToDialog,
  Badge,
  Card,
  ChannelChip,
  Field,
  Icon,
  Modal,
  PageHead,
  PmButton,
  Switch,
  TableWrap,
} from "../../components";
import { SETTINGS_SECTIONS, type SettingsSection } from "./sections";
import { openTossCardAuth } from "./toss-billing";
import "./settings.css";

interface SettingsScreenProps {
  section: SettingsSection;
  data: SettingsData;
  /** 모든 채널 (연결 전 포함) */
  channels: readonly ChannelAccount[];
  /** 없으면 예시 화면 */
  actions?: SettingsActions;
  /** 토스페이먼츠 카드 등록 창 — 없으면 개발용 테스트 카드 */
  cardAuth?: { clientKey: string; customerKey: string };
  /** 카드 등록 창에서 돌아온 결과 (?card=ok · ?cardError=…) */
  cardResult?: { ok: boolean; message: string };
  /** 지금 업장에서 내 역할 — 매니저는 업장 정보 읽기 전용 · 채널 연결/끊기 · 초대/권한 · 구독·결제 불가 */
  role?: "owner" | "manager";
  /** 채널 연동에서 강조할 채널 (?channel=) */
  focusChannel?: string;
  /** 알림 설정을 함께 적용할 수 있는 다른 업장 (사장님·매니저인 업장) */
  otherProperties?: readonly { id: string; name: string }[];
}

/** 저장 동작 + 결과 문구 (예시 화면이면 저장하지 않고 안내만) */
function useAction(actions?: SettingsActions) {
  const router = useRouter();
  const [note, setNote] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: (a: SettingsActions) => Promise<ActionResult<unknown>>, done: string, after?: () => void) =>
    start(async () => {
      if (!actions)
        return setNote({ bad: false, text: "체험 모드라 저장되지 않아요. 실제 서비스에서는 바로 반영돼요." });
      const r = await fn(actions);
      if (!r.ok) return setNote({ bad: true, text: r.message });
      after?.();
      setNote({ bad: false, text: done });
      router.refresh();
    });
  const message = note && (
    <p className={cx("se-msg", note.bad && "is-bad")} role={note.bad ? "alert" : "status"}>
      {note.text}
    </p>
  );
  return { run, pending, message, setNote };
}

export function SettingsScreen({
  section,
  data,
  channels,
  actions,
  cardAuth,
  cardResult,
  role = "owner",
  focusChannel,
  otherProperties = [],
}: SettingsScreenProps) {
  // 모바일에서 메뉴가 가로로 스크롤되므로 지금 메뉴가 보이게 맞춘다
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current;
    const on = el?.querySelector<HTMLElement>(".is-on");
    if (el && on && el.scrollWidth > el.clientWidth)
      el.scrollLeft +=
        on.getBoundingClientRect().left - el.getBoundingClientRect().left - (el.clientWidth - on.offsetWidth) / 2;
  }, [section]);
  return (
    <div className="se">
      <PageHead title="설정" desc="업장 정보, 채널 연결, 직원 계정, 알림, 구독을 한곳에서 관리해요." />
      <div className="se-layout">
        <nav ref={nav} className="se-nav" aria-label="설정 메뉴">
          {SETTINGS_SECTIONS.map((s) => (
            <Link
              key={s.id}
              href={`/app/settings/${s.id}`}
              className={cx("se-nav__item", s.id === section && "is-on")}
              aria-current={s.id === section ? "page" : undefined}
            >
              {s.label}
            </Link>
          ))}
        </nav>
        <div className="se-body">
          {section === "property" && <PropertySection data={data} actions={actions} owner={role === "owner"} />}
          {section === "property" && role === "owner" && (
            <div className="se-addprop">
              <p>
                <strong>운영하는 업장이 더 있으세요?</strong> 업장을 추가하면 업장마다 따로 관리하고, 전체 현황에서 함께
                볼 수 있어요.
              </p>
              <PmButton icon="plus" href="/app/onboarding?add=1">
                업장 추가
              </PmButton>
            </div>
          )}
          {section === "channels" && (
            <ChannelsSection channels={channels} actions={actions} owner={role === "owner"} focus={focusChannel} />
          )}
          {section === "accounts" && <AccountsSection data={data} actions={actions} owner={role === "owner"} />}
          {section === "notifications" && (
            <NotificationsSection data={data} actions={actions} otherProperties={otherProperties} />
          )}
          {section === "billing" &&
            (role !== "owner" ? (
              <Card title="구독·결제">
                <p className="se-sub">구독·결제는 사장님만 볼 수 있어요.</p>
              </Card>
            ) : data.billingVisible === false ? (
              <Card title="구독·결제">
                <p className="se-sub">구독 정보를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</p>
              </Card>
            ) : (
              <BillingSection data={data} actions={actions} cardAuth={cardAuth} cardResult={cardResult} />
            ))}
        </div>
      </div>
    </div>
  );
}

/* F0-02 업장 정보 */
const TYPES: { id: PropertyType; label: string }[] = [
  { id: "hotel", label: "호텔" },
  { id: "motel", label: "모텔" },
  { id: "pension", label: "펜션" },
  { id: "guesthouse", label: "게스트하우스" },
];

/** owner false(매니저): 읽기 전용 — 저장 버튼 없음 */
function PropertySection({ data, actions, owner }: { data: SettingsData; actions?: SettingsActions; owner: boolean }) {
  const p = data.profile;
  const ro = !owner;
  const { run, pending, message } = useAction(actions);
  const [f, setF] = useState({ name: p.name, address: p.address, rooms: String(p.rooms), phone: p.phone });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Card title="업장 정보">
      <Field layout="row" label="업장 이름">
        <input className="pm-input" value={f.name} onChange={set("name")} readOnly={ro} />
      </Field>
      <Field layout="row" label="숙박 유형">
        <div className="pm-choice">
          {TYPES.map((t) => (
            <label key={t.id}>
              <input type="radio" name="ptype" defaultChecked={t.id === p.type} disabled />
              {t.label}
            </label>
          ))}
        </div>
      </Field>
      <Field layout="row" label="주소">
        <input className="pm-input" value={f.address} onChange={set("address")} readOnly={ro} />
      </Field>
      <Field layout="row" label="객실 수">
        <input
          className="pm-input num se-short"
          inputMode="numeric"
          value={f.rooms}
          onChange={set("rooms")}
          readOnly={ro}
        />
      </Field>
      <Field layout="row" label="사업자등록번호" hint="바꾸려면 고객센터에 문의해 주세요.">
        <input className="pm-input num se-short" defaultValue={p.bizNo} readOnly />
      </Field>
      <Field layout="row" label="대표자">
        <input className="pm-input se-short" defaultValue={p.owner} readOnly />
      </Field>
      <Field layout="row" label="업장 연락처">
        <input className="pm-input se-short" inputMode="tel" value={f.phone} onChange={set("phone")} readOnly={ro} />
      </Field>
      {message}
      {ro ? (
        <p className="se-sub se-owner-only">업장 정보는 사장님만 바꿀 수 있어요.</p>
      ) : (
        <div className="se-actions">
          <PmButton
            variant="primary"
            disabled={pending || !f.name.trim() || !Number(f.rooms)}
            onClick={() =>
              run(
                (a) =>
                  a.saveProperty({
                    name: f.name.trim(),
                    address: f.address.trim(),
                    rooms: Number(f.rooms),
                    phone: f.phone.trim(),
                  }),
                "업장 정보를 저장했어요.",
              )
            }
          >
            {pending ? "저장 중…" : "변경 저장"}
          </PmButton>
        </div>
      )}
    </Card>
  );
}

/* F0-04 채널 연동 */
function channelState(c: ChannelAccount): { tone: "ok" | "info" | "bad" | "neutral"; label: string } {
  if (!c.connected) return { tone: "neutral", label: "연결 안 됨" };
  // 정상은 배지 없이 회색 글자 (D-02) — 아래 표에서 tone "ok" 면 글자만
  // 끊긴 이유(로그인 만료 · 수집 실패)와 상관없이 한 이름으로 — 할 일은 오른쪽 버튼이 알려 준다
  if (c.authExpired || c.status === "error") return { tone: "bad", label: "연동 끊김" };
  if (c.status === "syncing") return { tone: "info", label: "수집 중" };
  return { tone: "ok", label: "정상" };
}

/** owner false(매니저): 지금 수집만 — 연결·다시 로그인·연결 끊기는 사장님만 */
function ChannelsSection({
  channels: all,
  actions,
  owner,
  focus,
}: {
  channels: readonly ChannelAccount[];
  actions?: SettingsActions;
  owner: boolean;
  /** ?channel= — 이 채널 줄을 강조하고 그 줄로 */
  focus?: string;
}) {
  const { run, pending, message, setNote } = useAction(actions);
  const broken = (c: ChannelAccount) => c.connected && (c.authExpired || c.status === "error");
  // 끊긴 채널을 맨 위로 (휴대폰에서 스크롤하지 않아도 보이게), 나머지는 원래 순서
  const channels = [...all].sort((a, b) => Number(broken(b)) - Number(broken(a)));
  const focusRow = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    focusRow.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focus]);
  const [login, setLogin] = useState<ChannelAccount | null>(null);
  const [unlink, setUnlink] = useState<ChannelAccount | null>(null);
  const [busy, setBusy] = useState<ChannelId | null>(null);
  const connected = channels.filter((c) => c.connected).length;
  const sync = (c: ChannelAccount) => {
    setBusy(c.channel);
    run(
      (a) => a.syncChannel(c.channel),
      `${c.name}에서 지금 수집을 시작했어요.`,
      () => setBusy(null),
    );
  };
  return (
    <Card title="채널 연동" meta={`${channels.length}곳 중 ${connected}곳 연결됨`} flush>
      {/* 끊긴 채널은 표 위에 한 줄씩 — 휴대폰에서 표를 옆으로 밀지 않아도 바로 다시 로그인 */}
      {channels.filter(broken).length > 0 && (
        <ul className="se-broken">
          {channels.filter(broken).map((c) => (
            <li key={c.channel} className={cx(focus === c.channel && "is-focus")}>
              <ChannelChip channel={c.channel} name={c.name} />
              <span>{c.authExpired ? "로그인이 풀려 연동이 끊겼어요." : "예약·리뷰를 가져오지 못하고 있어요."}</span>
              {owner ? (
                <PmButton size="sm" variant="alert" icon="sync" onClick={() => setLogin(c)}>
                  다시 로그인
                </PmButton>
              ) : (
                <span className="is-muted se-owner-note">사장님만 다시 연결할 수 있어요</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <TableWrap>
        <table className="pm-table pm-rtable se-channels">
          <thead>
            <tr>
              <th>채널</th>
              <th>상태</th>
              <th>마지막 수집</th>
              <th>답글 달기</th>
              <th>
                <span className="pm-sr">동작</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => {
              const st = channelState(c);
              const needLogin = broken(c);
              const focused = focus === c.channel;
              return (
                <tr
                  key={c.channel}
                  ref={focused ? focusRow : undefined}
                  className={cx(needLogin && "is-problem", focused && "is-focus")}
                >
                  <td className="pm-rtable__main">
                    <ChannelChip channel={c.channel} name={c.name} />
                  </td>
                  <td className="pm-rtable__state">
                    {st.tone === "ok" || st.tone === "neutral" ? (
                      <span className="is-muted">{st.tone === "ok" ? "연결됨" : st.label}</span>
                    ) : (
                      <Badge tone={st.tone} dot>
                        {st.label}
                      </Badge>
                    )}
                  </td>
                  <td className="num is-muted" data-label="마지막 수집">
                    {c.connected ? c.lastSyncedAt : "–"}
                  </td>
                  <td data-label="답글">
                    {c.replyMode === "api" ? "자동 등록" : <span className="is-muted">직접 붙여넣기</span>}
                  </td>
                  <td className="is-num pm-rtable__act">
                    <span className="se-row-actions">
                      {!owner && (!c.connected || needLogin) && (
                        <span className="is-muted se-owner-note">사장님만 바꿀 수 있어요</span>
                      )}
                      {owner && !c.connected && (
                        <PmButton size="sm" variant="ghost" icon="link" onClick={() => setLogin(c)}>
                          연결
                        </PmButton>
                      )}
                      {owner && needLogin && (
                        <PmButton size="sm" variant="alert" icon="sync" onClick={() => setLogin(c)}>
                          다시 로그인
                        </PmButton>
                      )}
                      {c.connected && !needLogin && (
                        <PmButton size="sm" variant="ghost" icon="sync" disabled={pending} onClick={() => sync(c)}>
                          {pending && busy === c.channel ? "요청 중…" : "지금 수집"}
                        </PmButton>
                      )}
                      {owner && c.connected && actions?.disconnectChannel && (
                        <PmButton size="sm" variant="quiet" disabled={pending} onClick={() => setUnlink(c)}>
                          연결 끊기
                        </PmButton>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
      {message && <div className="se-invite__msg">{message}</div>}
      <p className="se-foot">
        30분마다 새 예약·리뷰·정산을 가져와요. 로그인이 실패하거나 2차 인증을 요구하면 알림으로 다시 로그인을
        부탁드려요.
        {!owner && " 채널 연결과 연결 끊기는 사장님만 바꿀 수 있어요."}
      </p>
      {login && (
        <ChannelLoginDialog
          channel={login}
          actions={actions}
          onClose={() => setLogin(null)}
          onDone={(text) => {
            setLogin(null);
            setNote({ bad: false, text });
          }}
        />
      )}
      {unlink && (
        <Modal
          title={`${unlink.name} 연결을 끊을까요?`}
          desc="저장해 둔 채널 계정 정보를 지우고 수집을 멈춰요. 이미 가져온 예약·리뷰는 그대로 남아요."
          onClose={() => setUnlink(null)}
          footer={
            <>
              <PmButton variant="ghost" onClick={() => setUnlink(null)}>
                취소
              </PmButton>
              <PmButton
                variant="navy"
                disabled={pending}
                onClick={() => {
                  const c = unlink;
                  setUnlink(null);
                  run((a) => a.disconnectChannel!(c.channel), `${c.name} 연결을 끊었어요.`);
                }}
              >
                연결 끊기
              </PmButton>
            </>
          }
        >
          <p className="se-sub">다시 연결하려면 파트너센터 아이디·비밀번호를 한 번 더 입력하면 돼요.</p>
        </Modal>
      )}
    </Card>
  );
}

/** 채널 연결 · 다시 로그인 — 파트너센터 계정 + 위탁 동의 */
function ChannelLoginDialog({
  channel,
  actions,
  onClose,
  onDone,
}: {
  channel: ChannelAccount;
  actions?: SettingsActions;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const router = useRouter();
  const [f, setF] = useState({ loginId: "", password: "" });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const again = channel.connected;
  const submit = () =>
    start(async () => {
      setError(null);
      if (!actions) return onDone("체험 모드라 저장되지 않아요. 실제 서비스에서는 바로 반영돼요.");
      const r = await actions.connectChannel(channel.channel, f.loginId.trim(), f.password);
      if (!r.ok) return setError(r.message);
      onDone(
        r.data.newReviews > 0
          ? `${josa(channel.name, "을/를")} 연결했어요. 리뷰 ${r.data.newReviews}건을 가져왔어요.`
          : `${josa(channel.name, "을/를")} 연결했어요. 예약·리뷰를 가져오는 중이에요.`,
      );
      router.refresh();
    });
  return (
    <Modal
      title={again ? `${channel.name} 다시 로그인` : `${channel.name} 연결`}
      desc={`${channel.name} 파트너센터에서 쓰는 아이디·비밀번호를 입력해 주세요. 비밀번호는 암호화해서 보관해요.`}
      onClose={onClose}
      footer={
        <>
          <PmButton variant="ghost" onClick={onClose}>
            취소
          </PmButton>
          <PmButton
            variant="primary"
            disabled={pending || !consent || !f.loginId.trim() || !f.password}
            onClick={submit}
          >
            {pending ? "확인 중…" : again ? "다시 로그인" : "로그인하고 연결"}
          </PmButton>
        </>
      }
    >
      <form
        className="se-login"
        onSubmit={(e) => {
          e.preventDefault();
          if (consent && f.loginId && f.password) submit();
        }}
      >
        <Field label="파트너센터 아이디" required>
          <input
            className="pm-input"
            autoComplete="off"
            value={f.loginId}
            onChange={(e) => setF((x) => ({ ...x, loginId: e.target.value }))}
          />
        </Field>
        <Field label="비밀번호" required>
          <input
            className="pm-input"
            type="password"
            autoComplete="off"
            value={f.password}
            onChange={(e) => setF((x) => ({ ...x, password: e.target.value }))}
          />
        </Field>
        <label className="se-consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            <strong>(필수) 채널 계정 정보 위탁·수집 동의</strong>
            <small>
              {channel.name}의 예약·리뷰·정산 정보를 우주스테이가 대신 가져오는 데 동의해요. 언제든 연결을 끊을 수
              있어요.
            </small>
          </span>
        </label>
        {error && (
          <p className="pm-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/* F0-03 직원 계정·권한 */
const ROLE_LABEL: Record<AccountRole, string> = { owner: "사장님", manager: "매니저", staff: "직원" };
const PERMS: { menu: string; owner: boolean; manager: boolean; staff: boolean }[] = [
  { menu: "홈, 매출장부 조회", owner: true, manager: true, staff: false },
  { menu: "리뷰 답글 게시", owner: true, manager: true, staff: false },
  { menu: "요금·재고 변경", owner: true, manager: true, staff: false },
  { menu: "알바관리 직원, 근태, 교대표", owner: true, manager: true, staff: false },
  { menu: "급여, 근로계약서 발송", owner: true, manager: false, staff: false },
  { menu: "업장 정보, 채널 연결, 직원 초대", owner: true, manager: false, staff: false },
  { menu: "본인 출퇴근, 스케줄", owner: true, manager: true, staff: true },
  { menu: "선정산, 선지급, 구독 결제", owner: true, manager: false, staff: false },
];

/** 권한 고르기 — 바꾸면 바로 저장, 실패하면 되돌린다 */
function RoleSelect({
  member,
  actions,
  run,
  pending,
}: {
  member: AccountMember;
  actions?: SettingsActions;
  run: ReturnType<typeof useAction>["run"];
  pending: boolean;
}) {
  const [role, setRole] = useState(member.role);
  if (member.status !== "active" || !member.id || !actions) {
    return <span>{ROLE_LABEL[member.role]}</span>;
  }
  const id = member.id;
  return (
    <select
      className="pm-input se-select"
      aria-label={`${member.name} 권한`}
      value={role}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as "manager" | "staff";
        const prev = role;
        setRole(next);
        run(
          (a) =>
            a.changeRole(id, next).then((r) => {
              if (!r.ok) setRole(prev);
              return r;
            }),
          `${member.name}님 권한을 ${josa(ROLE_LABEL[next], "으로/로")} 바꿨어요.`,
        );
      }}
    >
      <option value="manager">매니저</option>
      <option value="staff">직원</option>
    </select>
  );
}

/** owner false(매니저): 보기만 — 초대·권한 바꾸기·업장에서 빼기는 사장님만 */
function AccountsSection({ data, actions, owner }: { data: SettingsData; actions?: SettingsActions; owner: boolean }) {
  const { run, pending, message } = useAction(actions);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"manager" | "staff">("manager");
  const [confirm, setConfirm] = useState<{ kind: "remove" | "cancel"; member: AccountMember } | null>(null);
  const edit = owner ? actions : undefined;
  return (
    <>
      <Card title="직원 계정" meta={`${data.accounts.length}명`} flush>
        <TableWrap>
          <table className="pm-table pm-rtable">
            <thead>
              <tr>
                <th>이름</th>
                <th>휴대폰</th>
                <th>권한</th>
                <th>상태</th>
                {owner && (
                  <th>
                    <span className="pm-sr">동작</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((a) => (
                <tr key={a.id ?? `${a.status}${a.phone}`}>
                  <td className="pm-rtable__main">
                    <strong>{a.name}</strong>
                  </td>
                  <td className="num is-muted" data-label="휴대폰">
                    {a.phone}
                  </td>
                  <td data-label="권한">
                    {a.role === "owner" ? (
                      <span className="is-muted">사장님</span>
                    ) : (
                      <RoleSelect member={a} actions={edit} run={run} pending={pending} />
                    )}
                  </td>
                  <td className="pm-rtable__state">
                    {/* 사용 중은 평소 상태 — 글자 없이 비워 두고, 초대 대기만 표시 (D-02) */}
                    {a.status === "active" ? (
                      <span className="is-muted">사용 중</span>
                    ) : (
                      <Badge tone="info">초대 보냄, 7일 유효</Badge>
                    )}
                  </td>
                  {owner && (
                    <td className="is-num pm-rtable__act">
                      <span className="se-row-actions">
                        {a.status === "invited" && a.id && actions?.resendInvite && (
                          <PmButton
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() =>
                              run(
                                (x) => x.resendInvite!(a.id!),
                                `${a.phone} 로 초대 문자를 다시 보냈어요. 7일 동안 쓸 수 있어요.`,
                              )
                            }
                          >
                            다시 보내기
                          </PmButton>
                        )}
                        {a.status === "invited" && a.id && actions?.cancelInvite && (
                          <PmButton
                            size="sm"
                            variant="quiet"
                            disabled={pending}
                            onClick={() => setConfirm({ kind: "cancel", member: a })}
                          >
                            초대 취소
                          </PmButton>
                        )}
                        {a.status === "active" && a.role !== "owner" && a.id && actions?.removeMember && (
                          <PmButton
                            size="sm"
                            variant="quiet"
                            disabled={pending}
                            onClick={() => setConfirm({ kind: "remove", member: a })}
                          >
                            업장에서 빼기
                          </PmButton>
                        )}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        {owner ? (
          <div className="se-invite">
            <input
              className="pm-input"
              placeholder="초대할 휴대폰 번호"
              aria-label="초대할 휴대폰 번호"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <select
              className="pm-input se-select"
              aria-label="초대할 권한"
              value={role}
              onChange={(e) => setRole(e.target.value as "manager" | "staff")}
            >
              <option value="manager">매니저</option>
              <option value="staff">직원</option>
            </select>
            <PmButton
              variant="primary"
              disabled={pending || phone.replace(/\D/g, "").length < 10}
              onClick={() =>
                run(
                  (a) => a.invite(phone, role),
                  `${phone} 로 초대 문자를 보냈어요.`,
                  () => setPhone(""),
                )
              }
            >
              초대 문자 보내기
            </PmButton>
          </div>
        ) : (
          <p className="se-foot">직원 초대와 권한 바꾸기는 사장님만 할 수 있어요.</p>
        )}
        {message && <div className="se-invite__msg">{message}</div>}
      </Card>
      {confirm?.kind === "remove" && (
        <Modal
          title={`${confirm.member.name}님을 업장에서 뺄까요?`}
          desc="이 업장 화면과 알림을 더 이상 볼 수 없어요. 알바관리의 직원 명단과 근무 기록은 그대로 남아요."
          onClose={() => setConfirm(null)}
          footer={
            <>
              <PmButton variant="ghost" onClick={() => setConfirm(null)}>
                취소
              </PmButton>
              <PmButton
                variant="navy"
                disabled={pending}
                onClick={() => {
                  const m = confirm.member;
                  setConfirm(null);
                  run((a) => a.removeMember!(m.id!), `${m.name}님을 업장에서 뺐어요.`);
                }}
              >
                업장에서 빼기
              </PmButton>
            </>
          }
        >
          <p className="se-sub">다시 함께하려면 초대 문자를 새로 보내면 돼요.</p>
        </Modal>
      )}
      {confirm?.kind === "cancel" && (
        <Modal
          title="초대를 취소할까요?"
          desc={`${confirm.member.phone} 로 보낸 초대 링크를 바로 쓸 수 없게 돼요.`}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <PmButton variant="ghost" onClick={() => setConfirm(null)}>
                그대로 두기
              </PmButton>
              <PmButton
                variant="navy"
                disabled={pending}
                onClick={() => {
                  const m = confirm.member;
                  setConfirm(null);
                  run((a) => a.cancelInvite!(m.id!), `${m.phone} 초대를 취소했어요.`);
                }}
              >
                초대 취소
              </PmButton>
            </>
          }
        >
          <p className="se-sub">필요하면 언제든 다시 초대할 수 있어요.</p>
        </Modal>
      )}
      <Card title="권한별로 할 수 있는 일" flush>
        <TableWrap>
          <table className="pm-table se-perm">
            <thead>
              <tr>
                <th>메뉴</th>
                {(["owner", "manager", "staff"] as const).map((r) => (
                  <th key={r}>{ROLE_LABEL[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMS.map((p) => (
                <tr key={p.menu}>
                  <td>{p.menu}</td>
                  {(["owner", "manager", "staff"] as const).map((r) => (
                    <td key={r}>
                      {p[r] ? (
                        <Icon name="check" size={16} className="se-yes" title="가능" />
                      ) : (
                        <span className="is-muted" aria-label="불가">
                          –
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </>
  );
}

/* F0-13 알림 */
const NOTI_ROWS: { kind: NoticeKind; label: string; desc: string }[] = [
  { kind: "review", label: "새 리뷰, 별점 3점 이하", desc: "저평점은 바로, 나머지는 하루 2번 모아서" },
  { kind: "settle", label: "정산 입금 예정과 입금 완료", desc: "전날 오전 9시" },
  { kind: "sync", label: "채널 연동 오류", desc: "바로 알림" },
  { kind: "billing", label: "구독 결제, 결제 실패", desc: "결제 3일 전, 실패하면 바로" },
  { kind: "staff", label: "직원 지각, 퇴근 누락", desc: "다음 날 오전" },
  {
    kind: "summary",
    label: "아침 요약",
    desc: "매일 8시, 업장별 어제 매출과 미답변·청소 지연·퇴근 누락을 한 건으로 (앱 알림만)",
  },
];
const NOTI_CH = [
  { key: "alimtalk", label: "문자·알림톡" },
  { key: "push", label: "앱 푸시" },
  { key: "email", label: "이메일" },
] as const;

function NotificationsSection({
  data,
  actions,
  otherProperties,
}: {
  data: SettingsData;
  actions?: SettingsActions;
  otherProperties: readonly { id: string; name: string }[];
}) {
  const { run, pending, message } = useAction(actions);
  const [rows, setRows] = useState<NoticeSetting[]>(
    () =>
      data.noticeSettings?.slice() ??
      NOTI_ROWS.map((r) => ({
        kind: r.kind,
        alimtalk: r.kind !== "summary",
        push: r.kind !== "billing",
        email: r.kind === "billing",
      })),
  );
  /** 서버가 아침 요약을 아직 모르면(예전 서버) 그 줄은 숨긴다 */
  const visibleRows = NOTI_ROWS.filter((r) => r.kind !== "summary" || rows.some((x) => x.kind === "summary"));
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyIds, setApplyIds] = useState<string[]>([]);
  const applyAll = () =>
    run(
      (a) => a.saveNotices(rows, applyIds),
      `알림 설정을 업장 ${applyIds.length}곳에도 똑같이 저장했어요.`,
      () => setApplyOpen(false),
    );
  const toggle = (kind: NoticeKind, key: (typeof NOTI_CH)[number]["key"], v: boolean) => {
    const prev = rows;
    const next = rows.map((r) => (r.kind === kind ? { ...r, [key]: v } : r));
    setRows(next);
    run(
      (a) =>
        a.saveNotices(next.filter((r) => r.kind === kind)).then((r) => {
          if (!r.ok) setRows(prev);
          return r;
        }),
      "알림 설정을 저장했어요.",
    );
  };
  return (
    <Card title="알림 받기" flush>
      <TableWrap>
        <table className="pm-table se-noti">
          <thead>
            <tr>
              <th>알림</th>
              {NOTI_CH.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => {
              const row = rows.find((x) => x.kind === r.kind);
              return (
                <tr key={r.kind}>
                  <td>
                    <strong>{r.label}</strong>
                    <small className="se-sub">{r.desc}</small>
                  </td>
                  {NOTI_CH.map((c) => (
                    <td key={c.key}>
                      {/* 아침 요약은 앱 알림으로만 보낸다 */}
                      {r.kind === "summary" && c.key !== "push" ? (
                        <span className="is-muted">–</span>
                      ) : (
                        <Switch
                          checked={row?.[c.key] ?? false}
                          label={`${r.label} ${c.label}`}
                          disabled={pending}
                          onChange={(v) => toggle(r.kind, c.key, v)}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
      {message && <div className="se-invite__msg">{message}</div>}
      {otherProperties.length > 0 && (
        <div className="se-apply">
          <p>업장이 여러 곳이면 이 설정을 다른 업장에도 똑같이 쓸 수 있어요.</p>
          <PmButton
            size="sm"
            onClick={() => {
              setApplyIds(otherProperties.map((p) => p.id));
              setApplyOpen(true);
            }}
          >
            다른 업장에도 적용
          </PmButton>
        </div>
      )}
      {applyOpen && (
        <ApplyToDialog
          title="알림 설정을 다른 업장에도 적용"
          desc="지금 보이는 알림 받기 설정을 고른 업장에도 똑같이 저장해요."
          properties={otherProperties}
          selected={applyIds}
          onChange={setApplyIds}
          pending={pending}
          onClose={() => setApplyOpen(false)}
          onApply={applyAll}
        />
      )}
    </Card>
  );
}

/* F0-08 구독 · F0-09 정기결제 */
function BillingSection({
  data,
  actions,
  cardAuth,
  cardResult,
}: {
  data: SettingsData;
  actions?: SettingsActions;
  cardAuth?: SettingsScreenProps["cardAuth"];
  cardResult?: SettingsScreenProps["cardResult"];
}) {
  const { run, pending, message } = useAction(actions);
  const [cardError, setCardError] = useState<string | null>(null);
  const registerCard = () => {
    if (!cardAuth) return run((a) => a.registerCard(), "결제 카드를 등록했어요. (개발용 테스트 카드)");
    setCardError(null);
    const begin = actions?.startCardAuth;
    if (!begin) return setCardError("카드 등록을 시작하지 못했어요. 새로고침한 뒤 다시 시도해 주세요.");
    void begin().then((r) => {
      if (!r.ok) return setCardError(r.message);
      openTossCardAuth(cardAuth.clientKey, cardAuth.customerKey, r.data.state).catch((e: Error) =>
        setCardError(e.message),
      );
    });
  };
  const [subs, setSubs] = useState<string[]>([...data.subscribed]);
  const sum = data.plans.filter((p) => subs.includes(p.id)).reduce((s, p) => s + p.price, 0);
  const inTrial = data.inTrial ?? true;
  const hasCard = data.hasCard ?? true;
  /** 해지는 한 번 더 묻는다 (스위치를 잘못 건드려도 바로 빠지지 않게) */
  const [cancelling, setCancelling] = useState<{ id: string; name: string } | null>(null);
  const toggle = (id: string, name: string, v: boolean) => {
    const prev = subs;
    setSubs((s) => (v ? [...s, id] : s.filter((x) => x !== id)));
    run(
      (a) =>
        a.setPlan(id, v).then((r) => {
          if (!r.ok) setSubs(prev);
          return r;
        }),
      v ? `${josa(name, "을/를")} 켰어요.` : `${name} 구독을 해지했어요.`,
    );
  };
  // 가장 최근 결제가 실패면 맨 위에 빨간 띠 — [다시 결제] 등록된 카드로 바로 · [카드 바꾸기] 새 카드로 (바꾸면 바로 다시 결제)
  const latest = [...data.billing].sort((a, b) => b.date.localeCompare(a.date))[0];
  const failed = latest?.status === "failed" ? latest : null;
  // 다시 결제를 누른 뒤 끝날 때까지만 "결제 중…" (다른 저장이 진행 중일 때는 버튼만 잠근다)
  const [retrying, setRetrying] = useState(false);
  if (retrying && !pending) setRetrying(false);
  const retry = () => {
    setRetrying(true);
    run(
      async (a) =>
        a.retryPayment
          ? a.retryPayment()
          : { ok: false as const, message: "지금은 다시 결제할 수 없어요. 카드를 바꿔 주세요." },
      failed ? `${formatWon(failed.amount)} 다시 결제했어요. 구독이 정상으로 돌아왔어요.` : "다시 결제했어요.",
    );
  };
  const pilotEnds = data.pilot?.endsAt;
  const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
  return (
    <>
      {failed && (
        <div className="se-failed" role="alert">
          <Icon name="alert" size={18} />
          <p>
            <strong>
              {Number(failed.date.slice(5, 7))}월 결제 실패 <span className="num">{formatWon(failed.amount)}</span>
            </strong>
            카드 한도나 유효기간을 확인한 뒤 다시 결제해 주세요. 카드를 바꾸면 새 카드로 바로 결제해요.
          </p>
          {!data.billingHeld && (
            <PmButton size="sm" variant="primary" disabled={pending} onClick={retry}>
              {retrying ? "결제 중…" : "다시 결제"}
            </PmButton>
          )}
          <PmButton size="sm" variant="ghost" disabled={pending} onClick={registerCard}>
            카드 바꾸기
          </PmButton>
        </div>
      )}
      {data.billingHeld && pilotEnds ? (
        <div className="se-trial">
          <Icon name="calendar" size={18} />
          <p>
            <strong>실증 기간 무료</strong> ({md(pilotEnds)}까지). 이 기간에는 결제하지 않고, 금액은 실증이 끝난 뒤
            확정해요.
          </p>
        </div>
      ) : (
        <div className="se-trial">
          <Icon name="calendar" size={18} />
          {inTrial ? (
            <p>
              <strong className="num">{data.trialEnds.replaceAll("-", ".")}</strong>까지 무료 체험 중이에요. 다음 결제일{" "}
              <strong className="num">{data.nextBilling.replaceAll("-", ".")}</strong>에{" "}
              <strong className="num">{formatWon(sum)}</strong>이 결제돼요.
            </p>
          ) : (
            <p>
              다음 결제일 <strong className="num">{data.nextBilling.replaceAll("-", ".")}</strong>, 월{" "}
              <strong className="num">{formatWon(sum)}</strong>
            </p>
          )}
        </div>
      )}
      {message}
      {(cardError || cardResult) && (
        <p className={cx("se-msg", (cardError || !cardResult?.ok) && "is-bad")} role="status">
          {cardError ?? cardResult?.message}
        </p>
      )}
      <Card title="구독 중인 서비스">
        <ul className="se-plans">
          {data.plans.map((p) => (
            <li key={p.id} className={cx(!p.available && "is-off")}>
              <span>
                <strong>{p.name}</strong>
                <small>{plainList(p.desc)}</small>
              </span>
              <span className="se-plans__price num">{p.available ? `${formatWon(p.price)}/월` : "준비 중"}</span>
              <Switch
                checked={subs.includes(p.id)}
                label={`${p.name} 구독`}
                disabled={!p.available || pending}
                onChange={(v) => (v ? toggle(p.id, p.name, true) : setCancelling({ id: p.id, name: p.name }))}
              />
            </li>
          ))}
        </ul>
        <p className="se-total">
          월 합계 <strong className="num">{formatWon(sum)}</strong>
        </p>
      </Card>
      {cancelling && (
        <Modal
          title={`${cancelling.name} 구독을 해지할까요?`}
          desc="다음 결제부터 빠져요."
          onClose={() => setCancelling(null)}
          footer={
            <>
              <PmButton variant="ghost" onClick={() => setCancelling(null)}>
                계속 쓰기
              </PmButton>
              <PmButton
                variant="navy"
                disabled={pending}
                onClick={() => {
                  const c = cancelling;
                  setCancelling(null);
                  toggle(c.id, c.name, false);
                }}
              >
                해지
              </PmButton>
            </>
          }
        >
          <p className="se-sub">필요하면 언제든 이 화면에서 다시 켤 수 있어요.</p>
        </Modal>
      )}
      <Card
        title="결제 수단"
        action={
          <PmButton size="sm" disabled={pending} onClick={registerCard}>
            {hasCard ? "카드 바꾸기" : "카드 등록"}
          </PmButton>
        }
      >
        <p className="se-card num">
          <Icon name="settle" size={18} /> {data.card}{" "}
          {hasCard ? (
            <Badge tone="ok">정기결제 등록됨</Badge>
          ) : (
            <Badge tone="warn">체험 끝나기 전에 등록해 주세요</Badge>
          )}
        </p>
        <p className="se-sub">
          결제 3일 전에 알려드려요. 실패하면 1·3·5일째 다시 시도하고, 그래도 안 되면 기능이 제한돼요.
        </p>
      </Card>
      <Card title="결제 내역" flush>
        <TableWrap>
          <table className="pm-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th>내용</th>
                <th className="is-num">금액</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {data.billing.length === 0 && (
                <tr>
                  <td colSpan={4} className="is-muted">
                    아직 결제한 내역이 없어요.
                  </td>
                </tr>
              )}
              {data.billing.map((b, i) => (
                <tr key={`${b.date}${i}`}>
                  <td className="num">{b.date.replaceAll("-", ".")}</td>
                  <td>{plainList(b.item)}</td>
                  <td className="is-num">{b.amount === 0 ? "₩0 (무료 체험)" : `${formatWon(b.amount)}`}</td>
                  <td>
                    {b.status === "paid" ? <Badge tone="ok">결제 완료</Badge> : <Badge tone="bad">결제 실패</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </>
  );
}
