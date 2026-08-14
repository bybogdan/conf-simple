import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Clock3, RotateCcw, X } from "lucide-react";
import { api } from "../api";
import type { Page, PageRevision } from "../types";
import { useModalDialog } from "./useModalDialog";

export function HistoryPanel({ page, onClose, onRestored }: { page: Page; onClose: () => void; onRestored: (page: Page) => void }) {
  const [revisions, setRevisions] = useState<PageRevision[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useModalDialog(onClose);
  const selected = revisions.find((revision) => revision.id === selectedId) ?? revisions[0];
  const editor = useEditor({ extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true })], editable: false, content: selected?.content, immediatelyRender: false });
  useEffect(() => { api.revisions(page.id).then((items) => { setRevisions(items); setSelectedId(items[0]?.id ?? null); }).catch((caught: Error) => setError(caught.message)); }, [page.id]);
  useEffect(() => { if (selected) editor?.commands.setContent(selected.content); }, [selected?.id, editor]);
  return <div className="overlay" onMouseDown={onClose}>
    <section ref={dialogRef} className="history-panel" role="dialog" aria-modal="true" aria-label="Page history" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><h2><Clock3 size={16} />Page history</h2><p>Saved checkpoints for “{page.title}”</p></div><button className="icon-button" onClick={onClose} aria-label="Close history"><X size={16} /></button></header>
      <div className="history-body">
        <nav aria-label="Revisions">{revisions.map((revision, index) => <button key={revision.id} className={revision.id === selected?.id ? "selected" : ""} onClick={() => setSelectedId(revision.id)}>
          <strong>{formatRevisionDate(revision.createdAt)}</strong><span>{revision.author}</span><small>{index === 0 ? "Current" : revision.reason === "restore" ? "Restored" : revision.reason === "created" ? "Created" : "Saved"}</small>
        </button>)}</nav>
        <article className="history-preview">{selected ? <><h1>{selected.title}</h1><p className="page-meta">{new Date(selected.createdAt).toLocaleString()} · by {selected.author}</p><EditorContent editor={editor} /></> : <p className="palette-empty">Loading history…</p>}</article>
      </div>
      {error && <p className="form-error">{error}</p>}
      <footer><span>Restoring keeps every later revision.</span><button className="primary" disabled={!selected || pending || selected?.id === revisions[0]?.id} onClick={async () => {
        if (!selected) return; setPending(true); setError("");
        try { const restored = await api.restoreRevision(page.id, selected.id, page.version); onRestored(restored); onClose(); }
        catch (caught) { setError(caught instanceof Error ? caught.message : "Could not restore revision"); setPending(false); }
      }}><RotateCcw size={13} />{pending ? "Restoring…" : "Restore this version"}</button></footer>
    </section>
  </div>;
}

function formatRevisionDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
