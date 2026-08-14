import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import {
  Check,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  History,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pencil,
  Quote,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api";
import { filterSlashCommands, findSlashMatch, type SlashCommandId, type SlashMatch } from "../editor/slashCommands";
import type { Page, RichDocument } from "../types";

type SlashMenuState = SlashMatch & {
  position: { left: number; top: number };
};

const commandIcons: Record<SlashCommandId, LucideIcon> = {
  text: Type,
  "heading-1": Heading1,
  "heading-2": Heading2,
  "heading-3": Heading3,
  "bullet-list": List,
  "numbered-list": ListOrdered,
  checklist: ListChecks,
  quote: Quote,
  "code-block": Code2,
  divider: Minus,
};

export function PageEditor({ page, editing, onEdit, onHistory, onCancel, onSaved }: { page: Page; editing: boolean; onEdit: () => void; onHistory: () => void; onCancel: () => void; onSaved: (page: Page) => void }) {
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState<RichDocument>(page.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  const [selectedCommand, setSelectedCommand] = useState(0);
  const slashMenuRef = useRef<SlashMenuState | null>(null);
  const selectedCommandRef = useRef(0);
  const filteredCommandsRef = useRef(filterSlashCommands(""));
  const slashKeyHandlerRef = useRef<(event: KeyboardEvent) => boolean>(() => false);
  const menuElementRef = useRef<HTMLDivElement>(null);
  const editor = useEditor({
    extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true })],
    content: page.content,
    editable: editing,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "prose-editor", "aria-label": "Page content" },
      handleKeyDown: (_view, event) => slashKeyHandlerRef.current(event),
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
    closeSlashMenu();
  }, [page.id, page.version]);

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

    const chain = editor.chain().focus().deleteRange(menu.range).clearNodes();
    closeSlashMenu();
    switch (commandId) {
      case "text": chain.setParagraph().run(); break;
      case "heading-1": chain.setHeading({ level: 1 }).run(); break;
      case "heading-2": chain.setHeading({ level: 2 }).run(); break;
      case "heading-3": chain.setHeading({ level: 3 }).run(); break;
      case "bullet-list": chain.toggleBulletList().run(); break;
      case "numbered-list": chain.toggleOrderedList().run(); break;
      case "checklist": chain.toggleTaskList().run(); break;
      case "quote": chain.toggleBlockquote().run(); break;
      case "code-block": chain.setCodeBlock().run(); break;
      case "divider": chain.setHorizontalRule().run(); break;
    }
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
    setSaving(true);
    setError("");
    try {
      const updated = await api.updatePage(page.id, { title: title.trim(), content, version: page.version });
      onSaved(updated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save page");
      setSaving(false);
    }
  }

  function discard() {
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
          <button className="secondary" onClick={discard}><X size={13} />Discard</button>
          <button className="primary" disabled={saving || !title.trim()} onClick={save}><Check size={13} />{saving ? "Saving…" : "Done"}</button>
        </> : <><button className="secondary" onClick={onHistory}><History size={13} />History</button><button className="secondary" onClick={onEdit}><Pencil size={13} />Edit</button></>}
      </div>
      <article className="article-width">
        {editing ? <input className="page-title-input" value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Page title" /> : <h1>{page.title}</h1>}
        <p className="page-meta">Updated {relativeDate(page.updatedAt)} · by {page.updatedBy}</p>
        {editing && <p className="editor-hint">Press <kbd>/</kbd> at the start of a line for blocks · Press <kbd>Enter</kbd> for a new paragraph</p>}
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
        {editing && <p className="editor-status">Changes are stored when you choose Done.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </article>
    </section>
  );
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
