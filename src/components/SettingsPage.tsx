import { useEffect, useState } from "react";
import { Check, HardDrive } from "lucide-react";
import { api } from "../api";
import type { Workspace } from "../types";
import { BrandMark } from "./BrandMark";

export function SettingsPage({ workspace, onWorkspaceChange }: { workspace: Workspace; onWorkspaceChange: (workspace: Workspace) => void }) {
  const [name, setName] = useState(workspace.name);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const isAdmin = workspace.role === "admin";
  useEffect(() => setName(workspace.name), [workspace.name]);

  return <section className="management-page settings-page">
    <header className="management-heading"><div><p className="eyebrow">Workspace</p><h1>Settings</h1><p>Keep the workspace recognizable and the self-hosted data easy to operate.</p></div></header>
    <form className="settings-section" onSubmit={async (event) => {
      event.preventDefault(); setSaving(true); setSaved(false); setError("");
      try { onWorkspaceChange(await api.updateWorkspace(name)); setSaved(true); }
      catch (caught) { setError((caught as Error).message); }
      finally { setSaving(false); }
    }}>
      <div className="settings-section-heading"><BrandMark className="brand-mark settings-mark" /><div><h2>Workspace profile</h2><p>The workspace name appears in the navigation sidebar.</p></div></div>
      <label className="settings-field"><span>Workspace name</span><input value={name} minLength={2} maxLength={80} disabled={!isAdmin} onChange={(event) => { setName(event.target.value); setSaved(false); }} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="settings-actions">{saved && <span className="saved-note"><Check size={13} />Saved</span>}<button className="primary" disabled={!isAdmin || saving || name.trim() === workspace.name}>{saving ? "Saving…" : "Save changes"}</button></div>
      {!isAdmin && <p className="readonly-note">Only workspace admins can change these settings.</p>}
    </form>
    <section className="settings-section data-section"><div className="settings-section-heading"><HardDrive size={20} /><div><h2>Data and backups</h2><p>The database and uploaded files live together in the persistent data directory.</p></div></div><p>Back up the complete <code>/data</code> volume. See the README for consistent SQLite backup, restore, and update steps.</p></section>
  </section>;
}
