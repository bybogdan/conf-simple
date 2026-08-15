import type { Editor } from "@tiptap/core";

const supportedAbsoluteProtocols = new Set(["http:", "https:", "mailto:"]);
type EditorRange = { from: number; to: number };

export function normalizeSafeLinkHref(value: string): string | null {
  const href = value.trim();
  if (!href || /[\u0000-\u001f\u007f]/.test(href)) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;

  try {
    const parsed = new URL(href);
    if (!supportedAbsoluteProtocols.has(parsed.protocol)) return null;
    if (parsed.protocol === "mailto:" && !parsed.pathname) return null;
    return href;
  } catch {
    return null;
  }
}

export function isSafeLinkHref(value: string) {
  return normalizeSafeLinkHref(value) !== null;
}

export function insertSafeLink(editor: Editor, text: string, value: string, range: EditorRange = editor.state.selection): boolean {
  const href = normalizeSafeLinkHref(value);
  const label = text.trim();
  if (!href || !label) return false;

  const inserted = editor.chain()
    .setTextSelection({ from: range.from, to: range.to })
    .insertContent({ type: "text", text: label, marks: [{ type: "link", attrs: { href } }] })
    .run();
  if (inserted) editor.commands.focus();
  return inserted;
}

export function applyInlineCode(editor: Editor, range: EditorRange = editor.state.selection): boolean {
  const chain = editor.chain().setTextSelection({ from: range.from, to: range.to });
  const applied = range.from !== range.to
    ? chain.toggleCode().run()
    : chain.insertContent({ type: "text", text: "inline code", marks: [{ type: "code" }] }).run();
  if (applied) editor.commands.focus();
  return applied;
}
