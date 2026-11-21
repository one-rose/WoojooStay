"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PeopleActions, PeopleRole, PortfolioPeople } from "@/core";
import { cx } from "@/shared";
import { Field, Icon, Modal, PageHead, PmButton } from "../../components";
import "./people.css";

interface PeopleScreenProps {
  data: PortfolioPeople;
  /** 실서버 저장. 없으면 화면에서만 바뀌는 체험 */
  actions?: PeopleActions;
}

type Person = PortfolioPeople["people"][number];
type Invitation = PortfolioPeople["invitations"][number];
type Assignable = "manager" | "staff";

const ROLE_LABEL: Record<PeopleRole, string> = { owner: "사장님", manager: "매니저", staff: "직원" };

/** 매니저 먼저, 맡은 업장 많은 순 */
const order = (a: Person, b: Person) => {
  const score = (p: Person) =>
    Object.values(p.roles).reduce((s, r) => s + (r === "manager" ? 100 : r === "owner" ? 1000 : 1), 0);
  return score(b) - score(a) || a.name.localeCompare(b.name, "ko");
};

/**
 * 업장별 매니저 권한 (F8) — 사장님 업장 전부의 사람을 한 표에서. 사람마다 업장별 권한을 한 번에 바꾸고,
 * 새 사람은 여러 업장에 한 번에 초대한다 (문자 한 통, 링크 하나로 모두 수락).
 */
export function PeopleScreen({ data: initial, actions }: PeopleScreenProps) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [base, setBase] = useState(initial);
  if (base !== initial) {
    setBase(initial);
    setData(initial);
  }
  const [editing, setEditing] = useState<Person | null>(null);
  const [inviting, setInviting] = useState(false);
  const [cancelling, setCancelling] = useState<Invitation | null>(null);
  const [busy, startBusy] = useTransition();
  /** 묶음 초대 — 업장마다 초대 id 가 있다. 다시 보내기는 한 곳만 부르면 묶음 전체가 연장된다 */
  const pairs = (i: Invitation) =>
    (i.invitationIds ?? []).map((id, k) => ({ id, propertyId: i.propertyIds[k] })).filter((x) => x.propertyId);
  const resend = (i: Invitation) =>
    startBusy(async () => {
      const first = pairs(i)[0];
      if (!actions?.resendInvite || !first) return;
      const r = await actions.resendInvite(first.id, first.propertyId);
      setToast(r.ok ? { text: `${i.phone} 로 초대 문자를 다시 보냈어요.` } : { text: r.message, bad: true });
      if (r.ok) router.refresh();
    });
  const cancel = (i: Invitation) =>
    startBusy(async () => {
      if (!actions?.cancelInvite) return;
      for (const p of pairs(i)) {
        const r = await actions.cancelInvite(p.id, p.propertyId);
        if (!r.ok) {
          setToast({ text: r.message, bad: true });
          router.refresh();
          return;
        }
      }
      setCancelling(null);
      setToast({ text: `${i.phone} 초대를 취소했어요.` });
      router.refresh();
    });
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.bad ? 6000 : 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const { properties } = data;
  const people = [...data.people].sort(order);
  const managerCount = (pid: string) => data.people.filter((p) => p.roles[pid] === "manager").length;

  if (properties.length === 0) {
    return (
      <div className="pp">
        <PageHead
          title="직원·권한"
          desc="사장님인 업장의 매니저·직원을 정하는 곳이에요. 지금 계정은 사장님인 업장이 없어요."
        />
      </div>
    );
  }

  return (
    <div className="pp">
      <PageHead
        title="직원·권한"
        desc={`업장 ${properties.length}곳의 매니저·직원을 한곳에서 정해요. 매니저는 맡은 업장만 보고 관리할 수 있고, 결제·구독은 사장님만 봐요.`}
        actions={
          <PmButton variant="navy" icon="plus" onClick={() => setInviting(true)}>
            사람 초대
          </PmButton>
        }
      />

      <section className="pp-panel" aria-labelledby="pp-matrix">
        <header className="pp-panel__head">
          <h2 id="pp-matrix">업장별 권한</h2>
          <span>{people.length}명</span>
        </header>
        {people.length === 0 ? (
          <p className="pp-empty">아직 함께 일하는 사람이 없어요. 오른쪽 위 ‘사람 초대’로 매니저를 초대해 보세요.</p>
        ) : (
          <div className="pm-table-wrap pp-table-wrap">
            <table className="pm-table pp-table">
              <thead>
                <tr>
                  <th scope="col" className="pp-sticky">
                    이름
                  </th>
                  {properties.map((p) => (
                    <th key={p.id} scope="col" className="pp-prop" title={p.name}>
                      <span>{p.name}</span>
                    </th>
                  ))}
                  <th scope="col" className="pp-act">
                    <span className="pm-sr">권한 바꾸기</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.userId}>
                    <th scope="row" className="pp-sticky pp-person">
                      <strong>{person.name}</strong>
                      <small className="num">{person.phone}</small>
                    </th>
                    {properties.map((p) => {
                      const r = person.roles[p.id];
                      return (
                        <td key={p.id} className={cx("pp-cell", r && `is-${r}`)}>
                          {r ? ROLE_LABEL[r] : <span aria-label="권한 없음">–</span>}
                        </td>
                      );
                    })}
                    <td className="pp-act">
                      {Object.values(person.roles).includes("owner") ? (
                        <span className="pp-muted">사장님</span>
                      ) : (
                        <PmButton size="sm" variant="ghost" onClick={() => setEditing(person)}>
                          권한 바꾸기
                        </PmButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="pp-sticky">
                    매니저
                  </th>
                  {properties.map((p) => {
                    const n = managerCount(p.id);
                    return (
                      <td key={p.id} className={cx("pp-cell", n === 0 && "is-none")}>
                        {n === 0 ? "없음" : `${n}명`}
                      </td>
                    );
                  })}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {/* 휴대폰 — 표 대신 사람 목록. 누르면 업장별 권한 창 (D-07) */}
        {people.length > 0 && (
          <ul className="pp-mlist">
            {people.map((person) => {
              const roles = Object.values(person.roles);
              const isOwner = roles.includes("owner");
              const summary = (["manager", "staff"] as const)
                .map((r) => [r, roles.filter((x) => x === r).length] as const)
                .filter(([, n]) => n > 0)
                .map(([r, n]) => `${ROLE_LABEL[r]} ${n}곳`)
                .join(", ");
              const body = (
                <>
                  <span className="pp-mlist__who">
                    <strong>{person.name}</strong>
                    <small>{isOwner ? `사장님, 업장 ${roles.length}곳` : summary || "권한 없음"}</small>
                  </span>
                  {!isOwner && <Icon name="chevron" size={16} />}
                </>
              );
              return (
                <li key={person.userId}>
                  {isOwner ? (
                    <div className="pp-mlist__row">{body}</div>
                  ) : (
                    <button type="button" className="pp-mlist__row" onClick={() => setEditing(person)}>
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {data.invitations.length > 0 && (
        <section className="pp-panel" aria-labelledby="pp-invites">
          <header className="pp-panel__head">
            <h2 id="pp-invites">수락 기다리는 초대</h2>
            <span>{data.invitations.length}건</span>
          </header>
          <ul className="pp-invites">
            {data.invitations.map((i) => (
              <li key={`${i.phone}:${i.role}`}>
                <strong className="num">{i.phone}</strong>
                <span>{ROLE_LABEL[i.role]}</span>
                <span className="pp-invites__props">
                  {properties
                    .filter((p) => i.propertyIds.includes(p.id))
                    .map((p) => p.name)
                    .join(", ")}
                </span>
                <span className="pp-invites__end">
                  <small className="num">{i.expiresAt.slice(5).replace("-", ".")}까지</small>
                  {actions?.resendInvite && pairs(i).length > 0 && (
                    <PmButton size="sm" variant="ghost" disabled={busy} onClick={() => resend(i)}>
                      다시 보내기
                    </PmButton>
                  )}
                  {actions?.cancelInvite && pairs(i).length > 0 && (
                    <PmButton size="sm" variant="quiet" disabled={busy} onClick={() => setCancelling(i)}>
                      초대 취소
                    </PmButton>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && (
        <EditDialog
          person={editing}
          properties={properties}
          onClose={() => setEditing(null)}
          onSave={async (assignments) => {
            if (actions) {
              const r = await actions.assign(editing.userId, assignments);
              if (!r.ok) return r.message;
              setData(r.data);
              router.refresh();
            } else {
              // 체험 모드 — 화면에서만
              setData((d) => ({
                ...d,
                people: d.people
                  .map((p) => {
                    if (p.userId !== editing.userId) return p;
                    const roles: Record<string, PeopleRole> = { ...p.roles };
                    for (const a of assignments) {
                      if (a.role) roles[a.propertyId] = a.role;
                      else delete roles[a.propertyId];
                    }
                    return { ...p, roles };
                  })
                  .filter((p) => Object.keys(p.roles).length > 0),
              }));
            }
            setEditing(null);
            setToast({ text: `${editing.name}님의 권한을 바꿨어요.` });
            return null;
          }}
        />
      )}

      {cancelling && (
        <Modal
          title="초대를 취소할까요?"
          desc={`${cancelling.phone} 로 보낸 초대 링크를 바로 쓸 수 없게 돼요. 함께 보낸 업장 ${pairs(cancelling).length}곳 모두 취소돼요.`}
          onClose={() => setCancelling(null)}
          footer={
            <>
              <PmButton variant="ghost" onClick={() => setCancelling(null)}>
                그대로 두기
              </PmButton>
              <PmButton variant="navy" disabled={busy} onClick={() => cancel(cancelling)}>
                {busy ? "취소하는 중…" : "초대 취소"}
              </PmButton>
            </>
          }
        >
          <p className="pp-warn">필요하면 언제든 다시 초대할 수 있어요.</p>
        </Modal>
      )}

      {inviting && (
        <InviteDialog
          properties={properties}
          onClose={() => setInviting(false)}
          onSend={async (phone, role, ids) => {
            if (actions) {
              const r = await actions.invite(phone, role, ids);
              if (!r.ok) return r.message;
              router.refresh();
              setToast({
                text:
                  `${r.data.invited.length}곳에 초대 문자를 보냈어요.` +
                  (r.data.skipped.length ? ` 이미 함께 일하는 ${r.data.skipped.join(", ")}은(는) 건너뛰었어요.` : ""),
              });
            } else {
              setToast({ text: `${ids.length}곳에 초대 문자를 보냈어요. (체험 모드라 실제로 보내지 않아요)` });
            }
            setInviting(false);
            return null;
          }}
        />
      )}

      {toast && (
        <div className={cx("pp-toast", toast.bad && "is-bad")} role={toast.bad ? "alert" : "status"}>
          <Icon name={toast.bad ? "alert" : "check"} size={16} swap />
          {toast.text}
        </div>
      )}
    </div>
  );
}

interface EditDialogProps {
  person: Person;
  properties: PortfolioPeople["properties"];
  onClose: () => void;
  /** 실패하면 메시지 */
  onSave: (assignments: { propertyId: string; role: Assignable | null }[]) => Promise<string | null>;
}

function EditDialog({ person, properties, onClose, onSave }: EditDialogProps) {
  const start = Object.fromEntries(properties.map((p) => [p.id, (person.roles[p.id] ?? "") as Assignable | ""]));
  const [roles, setRoles] = useState(start);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const changed = properties.filter((p) => roles[p.id] !== start[p.id]);
  const left = Object.values(roles).filter(Boolean).length;

  const setAll = (r: Assignable | "") => setRoles(Object.fromEntries(properties.map((p) => [p.id, r])));

  const save = () =>
    startTransition(async () => {
      setError("");
      const msg = await onSave(changed.map((p) => ({ propertyId: p.id, role: roles[p.id] || null })));
      if (msg) setError(msg);
    });

  return (
    <Modal
      title={`${person.name}님 권한`}
      desc="업장마다 매니저·직원을 정해요. ‘권한 없음’으로 두면 그 업장에서 빠져요."
      onClose={onClose}
      wide
      footer={
        <>
          <PmButton variant="ghost" onClick={onClose}>
            닫기
          </PmButton>
          <PmButton variant="navy" onClick={save} disabled={pending || changed.length === 0}>
            {changed.length ? `${changed.length}곳 바꾸기` : "바뀐 곳 없음"}
          </PmButton>
        </>
      }
    >
      <div className="pp-bulk">
        <span>한 번에</span>
        <button type="button" onClick={() => setAll("manager")}>
          모두 매니저
        </button>
        <button type="button" onClick={() => setAll("staff")}>
          모두 직원
        </button>
        <button type="button" onClick={() => setAll("")}>
          모두 빼기
        </button>
      </div>
      <ul className="pp-roles">
        {properties.map((p) => (
          <li key={p.id} className={cx(roles[p.id] !== start[p.id] && "is-changed")}>
            <span className="pp-roles__name">{p.name}</span>
            <select
              className="pm-input"
              value={roles[p.id]}
              aria-label={`${p.name} 권한`}
              onChange={(e) => setRoles((r) => ({ ...r, [p.id]: e.target.value as Assignable | "" }))}
            >
              <option value="">권한 없음</option>
              <option value="manager">매니저</option>
              <option value="staff">직원</option>
            </select>
          </li>
        ))}
      </ul>
      {left === 0 && (
        <p className="pp-warn">모든 업장에서 빼면 이 목록에서도 사라져요. 다시 함께 일하려면 초대를 보내야 해요.</p>
      )}
      {error && (
        <p className="pp-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

interface InviteDialogProps {
  properties: PortfolioPeople["properties"];
  onClose: () => void;
  onSend: (phone: string, role: Assignable, propertyIds: string[]) => Promise<string | null>;
}

function InviteDialog({ properties, onClose, onSend }: InviteDialogProps) {
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Assignable>("manager");
  const [ids, setIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const all = ids.length === properties.length;
  const digits = phone.replace(/\D/g, "");
  const ready = /^01[016789]\d{7,8}$/.test(digits) && ids.length > 0;

  const toggle = (id: string) => setIds((x) => (x.includes(id) ? x.filter((v) => v !== id) : [...x, id]));

  const send = () =>
    startTransition(async () => {
      setError("");
      const msg = await onSend(digits, role, ids);
      if (msg) setError(msg);
    });

  return (
    <Modal
      title="사람 초대"
      desc="고른 업장에 한 번에 초대해요. 문자 한 통이 가고, 받은 사람이 링크로 가입하면 고른 업장 모두에 합류해요."
      onClose={onClose}
      wide
      footer={
        <>
          <PmButton variant="ghost" onClick={onClose}>
            닫기
          </PmButton>
          <PmButton variant="navy" onClick={send} disabled={!ready || pending}>
            {ids.length ? `${ids.length}곳에 초대 보내기` : "업장을 골라 주세요"}
          </PmButton>
        </>
      }
    >
      <div className="pp-invite">
        <Field label="휴대폰 번호" required>
          <input
            className="pm-input num"
            inputMode="tel"
            placeholder="010-0000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label="권한" required>
          <select className="pm-input" value={role} onChange={(e) => setRole(e.target.value as Assignable)}>
            <option value="manager">매니저</option>
            <option value="staff">직원</option>
          </select>
        </Field>
      </div>
      <p className="pp-hint">
        {role === "manager"
          ? "매니저는 고른 업장의 리뷰·매출·직원·현장 업무를 관리해요. 결제·구독은 사장님만 봐요."
          : "직원은 본인 출퇴근과 현장 업무(객실 상태·인수인계)만 해요."}
      </p>
      <fieldset className="pp-pick">
        <legend>
          업장 <span className="num">{ids.length}</span>/{properties.length}
          <button type="button" onClick={() => setIds(all ? [] : properties.map((p) => p.id))}>
            {all ? "모두 풀기" : "모두 고르기"}
          </button>
        </legend>
        <div className="pp-pick__grid">
          {properties.map((p) => (
            <label key={p.id} className={cx("pp-pick__item", ids.includes(p.id) && "is-on")}>
              <input type="checkbox" checked={ids.includes(p.id)} onChange={() => toggle(p.id)} />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p className="pp-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
