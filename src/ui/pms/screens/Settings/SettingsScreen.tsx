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
import { cx, formatNumber, josa } from "@/shared";
import { Badge, Card, ChannelChip, Field, Icon, Modal, PageHead, PmButton, Switch, TableWrap } from "../../components";
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

export function SettingsScreen({ section, data, channels, actions, cardAuth, cardResult }: SettingsScreenProps) {
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
          {section === "property" && <PropertySection data={data} actions={actions} />}
          {section === "channels" && <ChannelsSection channels={channels} actions={actions} />}
          {section === "accounts" && <AccountsSection data={data} actions={actions} />}
          {section === "notifications" && <NotificationsSection data={data} actions={actions} />}
          {section === "billing" && (
            <BillingSection data={data} actions={actions} cardAuth={cardAuth} cardResult={cardResult} />
          )}
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

function PropertySection({ data, actions }: { data: SettingsData; actions?: SettingsActions }) {
  const p = data.profile;
  const { run, pending, message } = useAction(actions);
  const [f, setF] = useState({ name: p.name, address: p.address, rooms: String(p.rooms), phone: p.phone });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Card title="업장 정보">
      <Field layout="row" label="업장 이름">
        <input className="pm-input" value={f.name} onChange={set("name")} />
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
        <input className="pm-input" value={f.address} onChange={set("address")} />
      </Field>
      <Field layout="row" label="객실 수">
        <input className="pm-input num se-short" inputMode="numeric" value={f.rooms} onChange={set("rooms")} />
      </Field>
      <Field layout="row" label="사업자등록번호" hint="바꾸려면 고객센터에 문의해 주세요.">
        <input className="pm-input num se-short" defaultValue={p.bizNo} readOnly />
      </Field>
      <Field layout="row" label="대표자">
        <input className="pm-input se-short" defaultValue={p.owner} readOnly />
      </Field>
      <Field layout="row" label="업장 연락처">
        <input className="pm-input se-short" inputMode="tel" value={f.phone} onChange={set("phone")} />
      </Field>
      {message}
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
    </Card>
  );
}

/* F0-04 채널 연동 */
function channelState(c: ChannelAccount): { tone: "ok" | "info" | "bad" | "neutral"; label: string } {
  if (!c.connected) return { tone: "neutral", label: "연결 안 됨" };
  if (c.authExpired) return { tone: "bad", label: "다시 로그인 필요" };
  if (c.status === "error") return { tone: "bad", label: "수집 오류" };
  if (c.status === "syncing") return { tone: "info", label: "수집 중" };
  return { tone: "ok", label: "정상" };
}

function ChannelsSection({ channels, actions }: { channels: readonly ChannelAccount[]; actions?: SettingsActions }) {
  const { run, pending, message, setNote } = useAction(actions);
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
      <TableWrap>
        <table className="pm-table se-channels">
          <thead>
            <tr>
              <th>채널</th>
              <th>상태</th>
              <th>마지막 수집</th>
              <th>답글 게시</th>
              <th>
                <span className="pm-sr">동작</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => {
              const st = channelState(c);
              const needLogin = c.connected && (c.authExpired || c.status === "error");
              return (
                <tr key={c.channel}>
                  <td>
                    <ChannelChip channel={c.channel} name={c.name} />
                  </td>
                  <td>
                    <Badge tone={st.tone} dot>
                      {st.label}
                    </Badge>
                  </td>
                  <td className="num is-muted">{c.connected ? c.lastSyncedAt : "–"}</td>
                  <td>{c.replyMode === "api" ? "자동 게시" : <span className="is-muted">복사 후 붙여넣기</span>}</td>
                  <td className="is-num">
                    <span className="se-row-actions">
                      {!c.connected && (
                        <PmButton size="sm" variant="ghost" icon="link" onClick={() => setLogin(c)}>
                          연결
                        </PmButton>
                      )}
                      {needLogin && (
                        <PmButton size="sm" variant="navy" icon="sync" onClick={() => setLogin(c)}>
                          다시 로그인
                        </PmButton>
                      )}
                      {c.connected && !needLogin && (
                        <PmButton size="sm" variant="ghost" icon="sync" disabled={pending} onClick={() => sync(c)}>
                          {pending && busy === c.channel ? "요청 중…" : "지금 수집"}
                        </PmButton>
                      )}
                      {c.connected && actions?.disconnectChannel && (
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
  { menu: "알바관리, 급여", owner: true, manager: false, staff: false },
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

function AccountsSection({ data, actions }: { data: SettingsData; actions?: SettingsActions }) {
  const { run, pending, message } = useAction(actions);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"manager" | "staff">("manager");
  return (
    <>
      <Card title="직원 계정" meta={`${data.accounts.length}명`} flush>
        <TableWrap>
          <table className="pm-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>휴대폰</th>
                <th>권한</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((a) => (
                <tr key={a.id ?? `${a.status}${a.phone}`}>
                  <td>
                    <strong>{a.name}</strong>
                  </td>
                  <td className="num is-muted">{a.phone}</td>
                  <td>
                    {a.role === "owner" ? (
                      <Badge tone="neutral">사장님</Badge>
                    ) : (
                      <RoleSelect member={a} actions={actions} run={run} pending={pending} />
                    )}
                  </td>
                  <td>
                    {a.status === "active" ? (
                      <Badge tone="ok">사용 중</Badge>
                    ) : (
                      <Badge tone="info">초대 보냄, 7일 유효</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
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
            variant="navy"
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
        {message && <div className="se-invite__msg">{message}</div>}
      </Card>
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
];
const NOTI_CH = [
  { key: "alimtalk", label: "문자·알림톡" },
  { key: "push", label: "앱 푸시" },
  { key: "email", label: "이메일" },
] as const;

function NotificationsSection({ data, actions }: { data: SettingsData; actions?: SettingsActions }) {
  const { run, pending, message } = useAction(actions);
  const [rows, setRows] = useState<NoticeSetting[]>(
    () =>
      data.noticeSettings?.slice() ??
      NOTI_ROWS.map((r) => ({ kind: r.kind, alimtalk: true, push: r.kind !== "billing", email: r.kind === "billing" })),
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
            {NOTI_ROWS.map((r) => {
              const row = rows.find((x) => x.kind === r.kind);
              return (
                <tr key={r.kind}>
                  <td>
                    <strong>{r.label}</strong>
                    <small className="se-sub">{r.desc}</small>
                  </td>
                  {NOTI_CH.map((c) => (
                    <td key={c.key}>
                      <Switch
                        checked={row?.[c.key] ?? false}
                        label={`${r.label} ${c.label}`}
                        disabled={pending}
                        onChange={(v) => toggle(r.kind, c.key, v)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
      {message && <div className="se-invite__msg">{message}</div>}
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
    openTossCardAuth(cardAuth.clientKey, cardAuth.customerKey).catch((e: Error) => setCardError(e.message));
  };
  const [subs, setSubs] = useState<string[]>([...data.subscribed]);
  const sum = data.plans.filter((p) => subs.includes(p.id)).reduce((s, p) => s + p.price, 0);
  const inTrial = data.inTrial ?? true;
  const hasCard = data.hasCard ?? true;
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
  return (
    <>
      <div className="se-trial">
        <Icon name="calendar" size={18} />
        {inTrial ? (
          <p>
            <strong className="num">{data.trialEnds.replaceAll("-", ".")}</strong> 까지 무료 체험 중이에요. 다음 결제일{" "}
            <strong className="num">{data.nextBilling.replaceAll("-", ".")}</strong> 에{" "}
            <strong className="num">₩{formatNumber(sum)}</strong> 이 결제돼요.
          </p>
        ) : (
          <p>
            다음 결제일 <strong className="num">{data.nextBilling.replaceAll("-", ".")}</strong>, 월{" "}
            <strong className="num">₩{formatNumber(sum)}</strong>
          </p>
        )}
      </div>
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
                <small>{p.desc}</small>
              </span>
              <span className="se-plans__price num">{p.available ? `₩${formatNumber(p.price)}/월` : "준비 중"}</span>
              <Switch
                checked={subs.includes(p.id)}
                label={`${p.name} 구독`}
                disabled={!p.available || pending}
                onChange={(v) => toggle(p.id, p.name, v)}
              />
            </li>
          ))}
        </ul>
        <p className="se-total">
          월 합계 <strong className="num">₩{formatNumber(sum)}</strong>
        </p>
      </Card>
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
                  <td>{b.item}</td>
                  <td className="is-num">{b.amount === 0 ? "₩0 (무료 체험)" : `₩${formatNumber(b.amount)}`}</td>
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
