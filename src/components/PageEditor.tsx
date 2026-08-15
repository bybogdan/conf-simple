import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  Check,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  History,
  ImagePlus,
  List,
  ListChecks,
  ListOrdered,
  Link2,
  Minus,
  Pencil,
  Paperclip,
  Quote,
  Table2,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api";
import { createEditorExtensions } from "../editor/extensions";
import { filterSlashCommands, findSlashMatch, type SlashCommandId, type SlashMatch } from "../editor/slashCommands";
import { applyInlineCode, insertSafeLink, normalizeSafeLinkHref } from "../editor/links";
import { insertUploadedMedia } from "../editor/mediaInsertion";
import { runEditorSave } from "../editor/saveLifecycle";
import type { Page, RichDocument } from "../types";
import { useModalDialog } from "./useModalDialog";

type SlashMenuState = SlashMatch & {
  position: { left: number; top: number };
};

type LinkDialogState = { from: number; to: number; text: string };

const commandIcons: Record<SlashCommandId, LucideIcon> = {
  text: Type,
  "heading-1": Heading1,
  "heading-2": Heading2,
  "heading-3": Heading3,
  "bullet-list": List,
  "numbered-list": ListOrdered,
  checklist: ListChecks,
  quote: Quote,
  "inline-code": Code2,
  "code-block": Code2,
  link: Link2,
  table: Table2,
  divider: Minus,
  image: ImagePlus,
  attachment: Paperclip,
};

export function PageEditor({ page, editing, onEdit, onHistory, onCancel, onSaved }: { page: Page; editing: boolean; onEdit: () => void; onHistory: () => void; onCancel: () => void; onSaved: (page: Page) => void }) {
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState<RichDocument>(page.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState("");
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  const [linkDialog, setLinkDialog] = useState<LinkDialogState | null>(null);
  const [selectedCommand, setSelectedCommand] = useState(0);
  const slashMenuRef = useRef<SlashMenuState | null>(null);
  const selectedCommandRef = useRef(0);
  const filteredCommandsRef = useRef(filterSlashCommands(""));
  const slashKeyHandlerRef = useRef<(event: KeyboardEvent) => boolean>(() => false);
  const menuElementRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadIdsRef = useRef(new Set<string>());
  const uploadFilesRef = useRef<(files: File[], position?: number) => void>(() => undefined);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const editor = useEditor({
    extensions: createEditorExtensions(),
    content: page.content,
    editable: editing,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "prose-editor", "aria-label": "Page content" },
      handleKeyDown: (view, event) => {
        if (slashKeyHandlerRef.current(event)) return true;
        if (editingRef.current && event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          const { from, to } = view.state.selection;
          setLinkDialog({ from, to, text: view.state.doc.textBetween(from, to, " ") });
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        if (!editingRef.current) return false;
        const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (!files.length) return false;
        event.preventDefault();
        uploadFilesRef.current(files);
        return true;
      },
      handleDrop: (view, event) => {
        if (!editingRef.current) return false;
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (!files.length) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        uploadFilesRef.current(files, position);
        return true;
      },
    },
    onUpdate: ({ editor: current }) => setContent(current.getJSON() as RichDocument),
  });

  const filteredCommands = filterSlashCommands(slashMenu?.query ?? "");
  filteredCommandsRef.current = filteredCommands;
  slashMenuRef.current = slashMenu;
  selectedCommandRef.current = selectedCommand;

  useEffect(() => {
    setTitle(page.title);
    setContent(page.content);
    editor?.commands.setContent(page.content);
    pendingUploadIdsRef.current.clear();
    setLinkDialog(null);
    closeSlashMenu();
  }, [page.id, page.version]);

  useEffect(() => () => {
    const pendingIds = [...pendingUploadIdsRef.current];
    pendingUploadIdsRef.current.clear();
    for (const id of pendingIds) void api.deleteUpload(id);
  }, [page.id]);

  useEffect(() => {
    editor?.setEditable(editing);
    if (!editing) closeSlashMenu();
  }, [editing, editor]);

  useEffect(() => {
    if (!editor) return;

    const updateSlashMenu = () => {
      const { selection } = editor.state;
      const { $from, from, empty } = selection;
      if (!editing || !empty || !$from.parent.isTextblock) {
        closeSlashMenu();
        return;
      }

      const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
      const match = findSlashMatch(textBeforeCursor, $from.start(), from);
      if (!match) {
        closeSlashMenu();
        return;
      }

      const coordinates = editor.view.coordsAtPos(from);
      const commands = filterSlashCommands(match.query);
      const estimatedHeight = Math.min(390, 40 + Math.max(commands.length, 1) * 51);
      const roomBelow = window.innerHeight - coordinates.bottom;
      const shouldFlip = roomBelow < estimatedHeight + 12 && coordinates.top > roomBelow;
      const top = shouldFlip
        ? Math.max(8, coordinates.top - estimatedHeight - 6)
        : Math.min(window.innerHeight - 48, coordinates.bottom + 6);
      const left = Math.max(8, Math.min(coordinates.left, window.innerWidth - 268));

      setSlashMenu((current) => {
        if (current?.query !== match.query) setSelectedCommandIndex(0);
        return { ...match, position: { left, top } };
      });
    };

    const closeOnBlur = () => closeSlashMenu();
    editor.on("update", updateSlashMenu);
    editor.on("selectionUpdate", updateSlashMenu);
    editor.on("blur", closeOnBlur);
    return () => {
      editor.off("update", updateSlashMenu);
      editor.off("selectionUpdate", updateSlashMenu);
      editor.off("blur", closeOnBlur);
    };
  }, [editor, editing]);

  useEffect(() => {
    const selected = menuElementRef.current?.querySelector<HTMLElement>("[aria-selected='true']");
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedCommand, slashMenu?.query]);

  function closeSlashMenu() {
    slashMenuRef.current = null;
    setSlashMenu(null);
  }

  function setSelectedCommandIndex(index: number) {
    selectedCommandRef.current = index;
    setSelectedCommand(index);
  }

  function executeSlashCommand(commandId: SlashCommandId) {
    const menu = slashMenuRef.current;
    if (!editor || !menu) return;

    closeSlashMenu();
    switch (commandId) {
      case "text": editor.chain().focus().deleteRange(menu.range).clearNodes().setParagraph().run(); break;
      case "heading-1": editor.chain().focus().deleteRange(menu.range).clearNodes().setHeading({ level: 1 }).run(); break;
      case "heading-2": editor.chain().focus().deleteRange(menu.range).clearNodes().setHeading({ level: 2 }).run(); break;
      case "heading-3": editor.chain().focus().deleteRange(menu.range).clearNodes().setHeading({ level: 3 }).run(); break;
      case "bullet-list": editor.chain().focus().deleteRange(menu.range).clearNodes().toggleBulletList().run(); break;
      case "numbered-list": editor.chain().focus().deleteRange(menu.range).clearNodes().toggleOrderedList().run(); break;
      case "checklist": editor.chain().focus().deleteRange(menu.range).clearNodes().toggleTaskList().run(); break;
      case "quote": editor.chain().focus().deleteRange(menu.range).clearNodes().toggleBlockquote().run(); break;
      case "inline-code":
        editor.chain().focus().deleteRange(menu.range).run();
        applyInlineCode(editor);
        break;
      case "code-block": editor.chain().focus().deleteRange(menu.range).clearNodes().setCodeBlock().run(); break;
      case "link": {
        editor.chain().focus().deleteRange(menu.range).run();
        const { from, to } = editor.state.selection;
        setLinkDialog({ from, to, text: "" });
        break;
      }
      case "table": editor.chain().focus().deleteRange(menu.range).clearNodes().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
      case "divider": editor.chain().focus().deleteRange(menu.range).clearNodes().setHorizontalRule().run(); break;
      case "image":
        editor.chain().focus().deleteRange(menu.range).clearNodes().run();
        imageInputRef.current?.click();
        break;
      case "attachment":
        editor.chain().focus().deleteRange(menu.range).clearNodes().run();
        attachmentInputRef.current?.click();
        break;
    }
  }

  async function uploadFiles(files: File[], position?: number) {
    if (!editor || !editingRef.current || !files.length) return;
    setError("");
    if (typeof position === "number") editor.chain().focus().setTextSelection(position).run();
    for (const file of files) {
      setUploading(`Uploading ${file.name}…`);
      try {
        const upload = await api.uploadFile(page.id, file);
        pendingUploadIdsRef.current.add(upload.id);
        editor.commands.focus();
        insertUploadedMedia(editor, upload);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : `Could not upload ${file.name}`);
      }
    }
    setUploading("");
  }

  uploadFilesRef.current = (files, position) => { void uploadFiles(files, position); };

  async function cleanupPendingUploads(keepReferenced: boolean) {
    const serializedContent = JSON.stringify(editor?.getJSON() ?? content);
    const removable = [...pendingUploadIdsRef.current].filter((id) => !keepReferenced || !serializedContent.includes(`/api/uploads/${id}`));
    await Promise.allSettled(removable.map((id) => api.deleteUpload(id)));
    removable.forEach((id) => pendingUploadIdsRef.current.delete(id));
  }

  slashKeyHandlerRef.current = (event) => {
    if (!slashMenuRef.current) return false;
    const commands = filteredCommandsRef.current;
    if (event.key === "Escape") {
      event.preventDefault();
      closeSlashMenu();
      return true;
    }
    if (event.key === "ArrowDown" && commands.length) {
      event.preventDefault();
      setSelectedCommandIndex((selectedCommandRef.current + 1) % commands.length);
      return true;
    }
    if (event.key === "ArrowUp" && commands.length) {
      event.preventDefault();
      setSelectedCommandIndex((selectedCommandRef.current - 1 + commands.length) % commands.length);
      return true;
    }
    if (event.key === "Enter" && commands.length) {
      event.preventDefault();
      executeSlashCommand(commands[selectedCommandRef.current]?.id ?? commands[0].id);
      return true;
    }
    return false;
  };

  async function save() {
    if (!title.trim()) return;
    setError("");
    await runEditorSave({
      setSaving,
      onError: setError,
      save: async () => {
        await cleanupPendingUploads(true);
        const currentContent = (editor?.getJSON() as RichDocument | undefined) ?? content;
        const updated = await api.updatePage(page.id, { title: title.trim(), content: currentContent, version: page.version });
        pendingUploadIdsRef.current.clear();
        return updated;
      },
      onSaved,
    });
  }

  async function discard() {
    await cleanupPendingUploads(false);
    setTitle(page.title);
    setContent(page.content);
    editor?.commands.setContent(page.content);
    setError("");
    onCancel();
  }

  return (
    <section className={`page-surface document-page ${editing ? "editing" : "reading"}`}>
      <div className="page-actions">
        {editing ? <>
          <button className="secondary" disabled={saving || Boolean(uploading)} onClick={() => void discard()}><X size={13} />Discard</button>
          <button className="secondary media-action" disabled={saving || Boolean(uploading)} onClick={() => imageInputRef.current?.click()}><ImagePlus size={13} />Image</button>
          <button className="secondary media-action" disabled={saving || Boolean(uploading)} onClick={() => attachmentInputRef.current?.click()}><Paperclip size={13} />File</button>
          <button className="primary" disabled={saving || Boolean(uploading) || !title.trim()} onClick={save}><Check size={13} />{saving ? "Saving…" : "Done"}</button>
        </> : <><button className="secondary" onClick={onHistory}><History size={13} />History</button><button className="secondary" onClick={onEdit}><Pencil size={13} />Edit</button></>}
      </div>
      <article className="article-width">
        {editing ? <input className="page-title-input" value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Page title" /> : <h1>{page.title}</h1>}
        <p className="page-meta">Updated {relativeDate(page.updatedAt)} · by {page.updatedBy}</p>
        {editing && <p className="editor-hint">Press <kbd>/</kbd> for blocks and formatting · <kbd>Ctrl/⌘ K</kbd> for links · Paste or drop files</p>}
        {editing && <>
          <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => { void uploadFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          <input ref={attachmentInputRef} className="visually-hidden" type="file" accept=".pdf,.zip,.docx,.xlsx,.pptx,.txt,.md,.csv,.json,image/png,image/jpeg,image/gif,image/webp" onChange={(event) => { void uploadFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
        </>}
        <EditorContent editor={editor} />
        {slashMenu && (
          <div
            ref={menuElementRef}
            className="slash-menu"
            role="listbox"
            aria-label="Insert block"
            style={{ left: slashMenu.position.left, top: slashMenu.position.top }}
            onMouseDown={(event) => event.preventDefault()}
          >
            <p className="slash-menu-label">Insert block</p>
            <div className="slash-menu-items">
              {filteredCommands.length ? filteredCommands.map((command, index) => {
                const Icon = commandIcons[command.id];
                return (
                  <button
                    key={command.id}
                    role="option"
                    aria-selected={index === selectedCommand}
                    onMouseEnter={() => setSelectedCommandIndex(index)}
                    onClick={() => executeSlashCommand(command.id)}
                  >
                    <span className="slash-command-icon"><Icon size={15} strokeWidth={1.65} /></span>
                    <span><strong>{command.label}</strong><small>{command.description}</small></span>
                  </button>
                );
              }) : <p className="slash-menu-empty">No matching blocks</p>}
            </div>
          </div>
        )}
        {editing && <p className="editor-status" aria-live="polite">{uploading || "Changes are stored when you choose Done."}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </article>
      {linkDialog && <LinkDialog
        initialText={linkDialog.text}
        onClose={() => { setLinkDialog(null); editor?.commands.focus(); }}
        onInsert={(text, href) => {
          if (!editor || !insertSafeLink(editor, text, href, linkDialog)) return false;
          setLinkDialog(null);
          return true;
        }}
      />}
    </section>
  );
}

function LinkDialog({ initialText, onClose, onInsert }: { initialText: string; onClose: () => void; onInsert: (text: string, href: string) => boolean }) {
  const [text, setText] = useState(initialText);
  const [href, setHref] = useState("");
  const [error, setError] = useState("");
  const closeRef = useRef(onClose);
  const textInputRef = useRef<HTMLInputElement>(null);
  const hrefInputRef = useRef<HTMLInputElement>(null);
  closeRef.current = onClose;
  const stableClose = useCallback(() => closeRef.current(), []);
  const dialogRef = useModalDialog(stableClose);
  useEffect(() => {
    (initialText ? hrefInputRef.current : textInputRef.current)?.focus();
  }, [initialText]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) {
      setError("Enter the text to display.");
      return;
    }
    if (!normalizeSafeLinkHref(href)) {
      setError("Use http://, https://, mailto:, or a path beginning with /.");
      return;
    }
    if (!onInsert(text, href)) setError("Could not insert this link.");
  }

  return <div className="overlay link-dialog-overlay" onMouseDown={stableClose}>
    <section ref={dialogRef} className="small-dialog link-dialog" role="dialog" aria-modal="true" aria-labelledby="insert-link-title" onMouseDown={(event) => event.stopPropagation()}>
      <form onSubmit={submit}>
      <header><div><h2 id="insert-link-title"><Link2 size={15} />Insert link</h2><p>Link to the web, email, or another page path.</p></div><button type="button" className="icon-button" onClick={stableClose} aria-label="Close link dialog"><X size={16} /></button></header>
      <label>Text<input ref={textInputRef} value={text} onChange={(event) => setText(event.target.value)} /></label>
      <label>URL or path<input ref={hrefInputRef} value={href} onChange={(event) => { setHref(event.target.value); setError(""); }} placeholder="https://example.com or /page" inputMode="url" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><button type="button" className="secondary" onClick={stableClose}>Cancel</button><button className="primary">Insert link</button></footer>
      </form>
    </section>
  </div>;
}

function relativeDate(value: string) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
