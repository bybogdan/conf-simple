import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, FilePlus2, FileText, LogOut, MoreHorizontal, Move, Plus, Search, Settings, Trash2, Users } from "lucide-react";
import { api } from "../api";
import { pagePath, sortedChildren } from "../pageTree";
import type { Page, User, Workspace } from "../types";
import { HistoryPanel } from "./HistoryPanel";
import { MovePageDialog } from "./MovePageDialog";
import { NewPage } from "./NewPage";
import { PageEditor } from "./PageEditor";
import { SearchPalette } from "./SearchPalette";

type Props = { user: User; workspace: Workspace; pages: Page[]; onPagesChange: (pages: Page[]) => void; onLogout: () => void };

export function WorkspaceShell({ user, workspace, pages, onPagesChange, onLogout }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(pages[0]?.id ?? null);
  const [mode, setMode] = useState<"read" | "edit" | "new">(pages.length ? "read" : "new");
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(pages.filter((page) => pages.some((child) => child.parentId === page.id)).map((page) => page.id)));
  const [pageMenuId, setPageMenuId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<Page | null>(null);
  const moveReturnFocus = useRef<HTMLElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const selected = pages.find((page) => page.id === selectedId) ?? null;
  const breadcrumbs = useMemo(() => selected ? pagePath(pages, selected) : [], [pages, selected]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function selectPage(id: string) {
    setSelectedId(id);
    setMode("read");
    setHistoryOpen(false);
    const page = pages.find((candidate) => candidate.id === id);
    if (page) setExpanded((current) => new Set([...current, ...pagePath(pages, page).slice(0, -1).map((item) => item.id)]));
  }

  async function move(page: Page, parentId: string | null, position?: number) {
    const next = await api.movePage(page.id, { parentId, position });
    onPagesChange(next);
    if (parentId) setExpanded((current) => new Set(current).add(parentId));
  }

  async function remove(page: Page) {
    if (!window.confirm(`Delete “${page.title}” and all of its child pages? This cannot be undone.`)) return;
    const parentId = page.parentId;
    const { deletedIds } = await api.deletePage(page.id);
    const remaining = pages.filter((candidate) => !deletedIds.includes(candidate.id));
    onPagesChange(remaining);
    if (deletedIds.includes(selectedId ?? "")) {
      const fallback = remaining.find((candidate) => candidate.id === parentId) ?? sortedChildren(remaining, null)[0] ?? null;
      setSelectedId(fallback?.id ?? null);
      setMode(fallback ? "read" : "new");
    }
  }

  return <div className="workspace-shell" onClick={() => setPageMenuId(null)}>
    <aside className="sidebar">
      <div className="workspace-name"><span className="workspace-mark">{workspace.name.charAt(0).toUpperCase()}</span><span>{workspace.name}</span></div>
      <div className="sidebar-actions">
        <button onClick={() => setSearchOpen(true)}><Search size={14} /><span>Search…</span><kbd>⌘K</kbd></button>
        <button onClick={() => { setNewParentId(null); setMode("new"); }}><Plus size={14} /><span>New page</span></button>
      </div>
      <div className="sidebar-divider" />
      <p className="sidebar-label">Pages</p>
      <nav className="page-tree" aria-label="Pages">
        <PageRows pages={pages} parentId={null} selectedId={selectedId} expanded={expanded} menuId={pageMenuId}
          onSelect={selectPage} onToggle={(id) => setExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; })}
          onMenu={(id) => setPageMenuId((current) => current === id ? null : id)}
          onAddChild={(page) => { setNewParentId(page.id); setExpanded((current) => new Set(current).add(page.id)); setMode("new"); setPageMenuId(null); }}
          onMoveTarget={(page) => {
            moveReturnFocus.current = document.querySelector<HTMLElement>(`[data-page-menu-id="${page.id}"]`);
            setMoveTarget(page); setPageMenuId(null);
          }} onMove={move} onDelete={remove} />
      </nav>
      <div className="sidebar-footer">
        <button><Users size={14} />Members</button><button><Settings size={14} />Settings</button><div className="sidebar-divider" />
        <button className="account-button" onClick={(event) => { event.stopPropagation(); setAccountOpen((open) => !open); }}><span className="avatar">{initials(user.displayName)}</span><span><strong>{user.displayName}</strong><small>{workspace.role === "admin" ? "Admin" : "Member"}</small></span><MoreHorizontal size={15} /></button>
        {accountOpen && <button className="logout-popover" onClick={onLogout}><LogOut size={14} />Sign out</button>}
      </div>
    </aside>
    <main className="main-pane">
      <header className="topbar">{mode === "new" ? <span>{newParentId ? "New child page" : "New page"}</span> : breadcrumbs.map((page, index) => <span key={page.id}>{index > 0 && <b>›</b>}{page.title}</span>)}</header>
      {mode === "new" ? <NewPage parentTitle={pages.find((page) => page.id === newParentId)?.title} onCancel={() => setMode(selected ? "read" : "new")} onCreate={async (title, content) => {
        const page = await api.createPage({ title, content, parentId: newParentId });
        onPagesChange([...pages, page]); setSelectedId(page.id); setMode("edit");
      }} /> : selected ? <PageEditor page={selected} editing={mode === "edit"} onEdit={() => setMode("edit")} onHistory={() => setHistoryOpen(true)} onCancel={() => setMode("read")} onSaved={(page) => { onPagesChange(pages.map((item) => item.id === page.id ? page : item)); setMode("read"); }} /> : <EmptyWorkspace onCreate={() => { setNewParentId(null); setMode("new"); }} />}
    </main>
    {searchOpen && <SearchPalette pages={pages} onClose={() => setSearchOpen(false)} onSelect={selectPage} />}
    {moveTarget && <MovePageDialog page={moveTarget} pages={pages} returnFocus={moveReturnFocus.current} onClose={() => setMoveTarget(null)} onMove={(parentId) => move(moveTarget, parentId)} />}
    {historyOpen && selected && <HistoryPanel page={selected} onClose={() => setHistoryOpen(false)} onRestored={(page) => { onPagesChange(pages.map((item) => item.id === page.id ? page : item)); }} />}
  </div>;
}

type RowsProps = {
  pages: Page[]; parentId: string | null; selectedId: string | null; expanded: Set<string>; menuId: string | null; depth?: number;
  onSelect: (id: string) => void; onToggle: (id: string) => void; onMenu: (id: string) => void; onAddChild: (page: Page) => void;
  onMoveTarget: (page: Page) => void; onMove: (page: Page, parentId: string | null, position?: number) => Promise<void>; onDelete: (page: Page) => Promise<void>;
};

function PageRows(props: RowsProps): React.ReactNode {
  const depth = props.depth ?? 0;
  const siblings = sortedChildren(props.pages, props.parentId);
  return siblings.map((page, index) => {
    const children = sortedChildren(props.pages, page.id);
    const open = props.expanded.has(page.id);
    return <div className="tree-node" key={page.id}>
      <div className={`page-row ${page.id === props.selectedId ? "selected" : ""}`} style={{ paddingLeft: 8 + depth * 16 }}>
        <button className={`tree-toggle ${open ? "open" : ""}`} disabled={!children.length} onClick={(event) => { event.stopPropagation(); props.onToggle(page.id); }} aria-label={open ? `Collapse ${page.title}` : `Expand ${page.title}`}><ChevronRight size={12} /></button>
        <button className="page-link" onClick={() => props.onSelect(page.id)}><FileText size={13} /><span>{page.title}</span></button>
        <button className="page-menu-trigger" data-page-menu-id={page.id} aria-label={`Page actions for ${page.title}`} onClick={(event) => { event.stopPropagation(); props.onMenu(page.id); }}><MoreHorizontal size={14} /></button>
        {props.menuId === page.id && <div className="page-context-menu" onClick={(event) => event.stopPropagation()}>
          <button onClick={() => props.onAddChild(page)}><FilePlus2 size={13} />New child page</button>
          <button disabled={index === 0} onClick={() => void props.onMove(page, page.parentId, index - 1)}>Move up</button>
          <button disabled={index === siblings.length - 1} onClick={() => void props.onMove(page, page.parentId, index + 1)}>Move down</button>
          <button onClick={() => props.onMoveTarget(page)}><Move size={13} />Move to…</button>
          <div className="menu-divider" /><button className="danger" onClick={() => void props.onDelete(page)}><Trash2 size={13} />Delete page</button>
        </div>}
      </div>
      {open && children.length > 0 && <PageRows {...props} parentId={page.id} depth={depth + 1} />}
    </div>;
  });
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function EmptyWorkspace({ onCreate }: { onCreate: () => void }) { return <section className="empty-workspace"><FileText size={28} strokeWidth={1.4} /><h1>Start your documentation</h1><p>Create the first page for your workspace.</p><button className="primary" onClick={onCreate}><Plus size={14} />New page</button></section>; }
