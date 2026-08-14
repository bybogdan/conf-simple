import { useState } from "react";
import { X } from "lucide-react";
import { descendantIds, pagePath } from "../pageTree";
import type { Page } from "../types";
import { useModalDialog } from "./useModalDialog";

export function MovePageDialog({ page, pages, onClose, onMove, returnFocus }: { page: Page; pages: Page[]; onClose: () => void; onMove: (parentId: string | null) => Promise<void>; returnFocus?: HTMLElement | null }) {
  const [parentId, setParentId] = useState(page.parentId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useModalDialog(onClose, returnFocus);
  const excluded = descendantIds(pages, page.id);
  excluded.add(page.id);
  const destinations = pages.filter((candidate) => !excluded.has(candidate.id));
  return <div className="overlay" onMouseDown={onClose}>
    <section ref={dialogRef} className="small-dialog" role="dialog" aria-modal="true" aria-labelledby="move-page-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><h2 id="move-page-title">Move “{page.title}”</h2><p>Choose a new parent. Its whole subtree moves with it.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={15} /></button></header>
      <label>Destination<select value={parentId} onChange={(event) => setParentId(event.target.value)}>
        <option value="">Root level</option>
        {destinations.map((candidate) => <option key={candidate.id} value={candidate.id}>{pagePath(pages, candidate).map((item) => item.title).join(" › ")}</option>)}
      </select></label>
      {error && <p className="form-error">{error}</p>}
      <footer><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={pending || parentId === (page.parentId ?? "")} onClick={async () => {
        setPending(true); setError("");
        try { await onMove(parentId || null); onClose(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not move page"); setPending(false); }
      }}>{pending ? "Moving…" : "Move page"}</button></footer>
    </section>
  </div>;
}
