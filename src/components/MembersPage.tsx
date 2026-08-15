import { useEffect, useRef, useState } from "react";
import { Copy, Plus, RefreshCw, Trash2, UserRound, Users } from "lucide-react";
import { api } from "../api";
import type { Invitation, Member, User, Workspace } from "../types";

export function MembersPage({ user, workspace }: { user: User; workspace: Workspace }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inviteInput = useRef<HTMLInputElement>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  const isAdmin = workspace.role === "admin";

  const load = () => {
    setLoading(true); setError("");
    api.members().then(setMembers).catch((caught: Error) => setError(caught.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function updateRole(member: Member, nextRole: "admin" | "member") {
    setBusyId(member.id); setError("");
    try {
      await api.updateMemberRole(member.id, nextRole);
      setMembers((current) => current.map((item) => item.id === member.id ? { ...item, role: nextRole } : item));
    } catch (caught) { setError((caught as Error).message); }
    finally { setBusyId(null); }
  }

  async function remove(member: Member) {
    if (!window.confirm(`Remove ${member.displayName} from this workspace? They will lose access immediately.`)) return;
    setBusyId(member.id); setError("");
    try { await api.removeMember(member.id); setMembers((current) => current.filter((item) => item.id !== member.id)); }
    catch (caught) { setError((caught as Error).message); }
    finally { setBusyId(null); }
  }

  const inviteUrl = invitation ? `${location.origin}/invite/${invitation.token}` : "";
  return <section className="management-page">
    <header className="management-heading"><div><p className="eyebrow">Workspace</p><h1>Members</h1><p>People who can read and edit documentation in {workspace.name}.</p></div>
      {isAdmin && <button className="primary" onClick={() => inviteInput.current?.focus()}><Plus size={14} />Invite member</button>}
    </header>

    {isAdmin && <form className="invite-card" onSubmit={async (event) => {
      event.preventDefault(); setBusyId("invite"); setError(""); setInvitation(null); setCopied(false);
      try { setInvitation(await api.createInvitation({ email, role })); }
      catch (caught) { setError((caught as Error).message); }
      finally { setBusyId(null); }
    }}>
      <div><strong>Invite with a link</strong><p>No email service is required. Share the generated link securely; it expires after seven days.</p></div>
      <div className="invite-fields"><label><span>Email</span><input ref={inviteInput} type="email" value={email} required placeholder="teammate@example.com" onChange={(event) => setEmail(event.target.value)} /></label>
        <label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value as "admin" | "member")}><option value="member">Member</option><option value="admin">Admin</option></select></label>
        <button className="secondary" disabled={busyId === "invite"}>{busyId === "invite" ? "Creating…" : "Create link"}</button></div>
      {invitation && <div className="invite-result" role="status"><input ref={linkInput} aria-label="Invitation link" value={inviteUrl} readOnly onFocus={(event) => event.currentTarget.select()} /><button type="button" className="secondary" onClick={async () => {
        try {
          if (navigator.clipboard) await navigator.clipboard.writeText(inviteUrl);
          else { linkInput.current?.select(); document.execCommand("copy"); }
          setCopied(true);
        } catch { setError("Could not copy the link. Select it and copy it manually."); }
      }}><Copy size={13} />{copied ? "Copied" : "Copy"}</button></div>}
    </form>}

    {error && <div className="inline-error" role="alert"><span>{error}</span><button onClick={load}><RefreshCw size={13} />Retry</button></div>}
    <div className="members-list" aria-busy={loading}>
      <div className="members-list-head"><span>{loading ? "Loading members…" : `${members.length} ${members.length === 1 ? "member" : "members"}`}</span><span>Role</span><span aria-hidden="true" /></div>
      {!loading && members.length === 0 && !error && <div className="management-empty"><Users size={24} /><p>No members found.</p></div>}
      {members.map((member) => <div className="member-row" key={member.id}>
        <span className="avatar member-avatar">{initials(member.displayName)}</span>
        <span className="member-identity"><strong>{member.displayName}{member.id === user.id && <em>You</em>}</strong><small>{member.email}</small></span>
        {isAdmin ? <select aria-label={`Role for ${member.displayName}`} value={member.role} disabled={busyId === member.id || member.id === user.id} onChange={(event) => void updateRole(member, event.target.value as "admin" | "member")}><option value="admin">Admin</option><option value="member">Member</option></select> : <span className="role-badge">{member.role === "admin" ? "Admin" : "Member"}</span>}
        {isAdmin ? <button className="icon-button danger-icon" aria-label={`Remove ${member.displayName}`} disabled={busyId === member.id || member.id === user.id} onClick={() => void remove(member)}><Trash2 size={14} /></button> : <span />}
      </div>)}
    </div>
    <p className="management-note"><UserRound size={13} />Members can create, edit, and move pages. Only admins can delete pages, manage members, and change workspace settings.</p>
  </section>;
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
