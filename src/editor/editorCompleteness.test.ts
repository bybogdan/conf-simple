import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorExtensions } from "./extensions";
import { safeAttachmentUrl } from "./fileAttachment";
import { applyInlineCode, insertSafeLink, normalizeSafeLinkHref } from "./links";

const editors: Editor[] = [];

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  vi.restoreAllMocks();
});

function createEditor(content: Record<string, unknown> = { type: "doc", content: [{ type: "paragraph" }] }) {
  const editor = new Editor({ extensions: createEditorExtensions(), content });
  editors.push(editor);
  return editor;
}

describe("complete shared editor schema", () => {
  it("creates a table and round-trips its JSON through the shared schema", () => {
    const source = createEditor();
    expect(source.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true })).toBe(true);

    const tableDocument = source.getJSON();
    const table = tableDocument.content?.find((node) => node.type === "table") as { content?: Array<{ type: string; content?: Array<{ type: string }> }> } | undefined;
    expect(table?.content).toHaveLength(3);
    expect(table?.content?.[0].content?.map((cell) => cell.type)).toEqual(["tableHeader", "tableHeader", "tableHeader"]);

    const restored = createEditor(tableDocument);
    expect(restored.getJSON()).toEqual(tableDocument);
    expect(restored.can().addRowAfter()).toBe(true);
    const tableExtension = restored.extensionManager.extensions.find((extension) => extension.name === "table");
    const addKeyboardShortcuts = tableExtension?.config.addKeyboardShortcuts as ((this: unknown) => Record<string, unknown>) | undefined;
    const keyboardShortcuts = addKeyboardShortcuts?.call(tableExtension) ?? {};
    expect(Object.keys(keyboardShortcuts)).toEqual(expect.arrayContaining(["Tab", "Shift-Tab"]));
  });

  it("parses media, attachments, task lists, and tables without dropping history nodes", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const historyContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Release notes" }] },
        { type: "image", attrs: { src: "/api/uploads/image-id", alt: "Diagram", title: "Diagram" } },
        { type: "fileAttachment", attrs: { url: "/api/uploads/file-id", name: "runbook.pdf", size: 2048 } },
        { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Ship it" }] }] }] },
        { type: "table", content: [{ type: "tableRow", content: [
          { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Owner" }] }] },
          { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Status" }] }] },
        ] }, { type: "tableRow", content: [
          { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Sam" }] }] },
          { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Done" }] }] },
        ] }] },
      ],
    };

    const preview = createEditor(historyContent);
    expect(preview.getJSON().content?.map((node) => node.type)).toEqual(["paragraph", "image", "fileAttachment", "taskList", "table"]);
    expect(JSON.stringify(preview.getJSON())).toContain("runbook.pdf");
    expect(JSON.stringify(preview.getJSON())).toContain("Ship it");
    expect(warning).not.toHaveBeenCalled();
  });

  it("only renders page-scoped upload URLs for legacy attachments", () => {
    expect(safeAttachmentUrl("javascript:globalThis.__confPwned=1")).toBeNull();
    expect(safeAttachmentUrl("https://example.com/file.txt")).toBeNull();
    expect(safeAttachmentUrl("/api/uploads/4477bf41-1bd7-49a9-bce0-426236ab3b10"))
      .toBe("/api/uploads/4477bf41-1bd7-49a9-bce0-426236ab3b10");
  });
});

describe("link insertion", () => {
  it("inserts safe web, email, and same-origin links", () => {
    expect(normalizeSafeLinkHref(" https://example.com/docs ")).toBe("https://example.com/docs");
    expect(normalizeSafeLinkHref("mailto:team@example.com")).toBe("mailto:team@example.com");
    expect(normalizeSafeLinkHref("/pages/getting-started")).toBe("/pages/getting-started");

    const editor = createEditor({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Read docs" }] }] });
    const linkExtension = editor.extensionManager.extensions.find((extension) => extension.name === "link");
    expect(linkExtension?.options.autolink).toBe(true);
    expect(linkExtension?.options.isAllowedUri("https://example.com", {})).toBe(true);
    expect(linkExtension?.options.isAllowedUri("javascript:alert(1)", {})).toBe(false);
    expect(insertSafeLink(editor, "Reference", "https://example.com/docs", { from: 1, to: 5 })).toBe(true);
    expect(editor.getJSON().content?.[0].content?.[0]).toMatchObject({
      type: "text",
      text: "Reference",
      marks: [{ type: "link", attrs: { href: "https://example.com/docs" } }],
    });
  });

  it("rejects script, data, protocol-relative, malformed, and empty links", () => {
    const editor = createEditor();
    const before = editor.getJSON();
    for (const href of ["javascript:alert(1)", "data:text/html,bad", "//evil.example/path", "example.com", "", "mailto:"]) {
      expect(insertSafeLink(editor, "Unsafe", href)).toBe(false);
      expect(normalizeSafeLinkHref(href)).toBeNull();
    }
    expect(editor.getJSON()).toEqual(before);
  });
});

describe("inline code insertion", () => {
  it("marks selected text and inserts an explicit sample at an empty cursor", () => {
    const selected = createEditor({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "use npm test" }] }] });
    expect(applyInlineCode(selected, { from: 5, to: 8 })).toBe(true);
    expect(selected.getJSON().content?.[0].content?.[1]).toMatchObject({ text: "npm", marks: [{ type: "code" }] });

    const empty = createEditor();
    expect(applyInlineCode(empty)).toBe(true);
    expect(empty.getJSON().content?.[0].content?.[0]).toMatchObject({ text: "inline code", marks: [{ type: "code" }] });
  });
});
