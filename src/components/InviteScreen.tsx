import { useEffect, useState } from "react";
import { api } from "../api";
import type { InvitationDetails, Page, User, Workspace } from "../types";
import { BrandLockup, BrandMark } from "./BrandMark";

type ReadyState = { user: User; workspace: Workspace; pages: Page[] };

export function InviteScreen({ token, onReady, onCancel }: { token: string; onReady: (state: ReadyState) => void; onCancel: () => void }) {
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.invitation(token).then((details) => {
      setInvitation(details);
      setDisplayName(details.displayName ?? "");
    }).catch((caught: Error) => setError(caught.message)).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="loading-screen" role="status" aria-label="Loading Pagecairn invitation"><BrandMark className="brand-mark" /></div>;
  if (!invitation) return <main className="fatal"><h1>Invitation unavailable</h1><p>{error}</p><button className="secondary" onClick={onCancel}>Go to sign in</button></main>;

  return <main className="auth-screen">
    <div className="auth-form-wrap">
      <BrandLockup />
      <div className="auth-heading">
        <p className="eyebrow">Workspace invitation</p>
        <h1>Join {invitation.workspaceName}</h1>
        <p>{invitation.accountExists ? "Confirm your existing account password to rejoin this workspace." : `Create your local account for ${invitation.email}.`}</p>
      </div>
      <form onSubmit={async (event) => {
        event.preventDefault(); setSubmitting(true); setError("");
        try { onReady(await api.acceptInvitation({ token, displayName, password })); }
        catch (caught) { setError((caught as Error).message); setSubmitting(false); }
      }}>
        <label className="field"><span>Email</span><input value={invitation.email} disabled /></label>
        <label className="field"><span>Display name</span><input value={displayName} minLength={2} maxLength={80} required disabled={invitation.accountExists} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" /></label>
        <label className="field"><span>{invitation.accountExists ? "Existing password" : "Password"}</span><input type="password" value={password} minLength={10} maxLength={200} required onChange={(event) => setPassword(event.target.value)} autoComplete={invitation.accountExists ? "current-password" : "new-password"} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary auth-submit" disabled={submitting}>{submitting ? "Joining…" : "Join workspace"}</button>
      </form>
    </div>
  </main>;
}
