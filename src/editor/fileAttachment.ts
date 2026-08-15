import { mergeAttributes, Node } from "@tiptap/core";

export const FileAttachment = Node.create({
  name: "fileAttachment",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      url: { default: null },
      name: { default: "Attachment" },
      size: { default: 0 },
    };
  },

  parseHTML() {
    return [{
      tag: "div[data-file-attachment]",
      getAttrs: (element) => {
        const node = element as HTMLElement;
        return {
          url: node.dataset.url,
          name: node.dataset.name,
          size: Number(node.dataset.size ?? 0),
        };
      },
    }];
  },

  renderHTML({ HTMLAttributes }) {
    const name = String(HTMLAttributes.name || "Attachment");
    const size = Number(HTMLAttributes.size || 0);
    const url = safeAttachmentUrl(HTMLAttributes.url);
    return [
      "div",
      mergeAttributes({
        "data-file-attachment": "",
        "data-url": url,
        "data-name": name,
        "data-size": size,
        class: "file-attachment",
      }),
      ["a", { ...(url ? { href: url, download: name } : {}), "aria-disabled": url ? undefined : "true" },
        ["span", { class: "file-attachment-name" }, name],
        ["span", { class: "file-attachment-size" }, formatBytes(size)],
      ],
    ];
  },

  renderText({ node }) {
    return String(node.attrs.name || "Attachment");
  },
});

export function safeAttachmentUrl(value: unknown): string | null {
  return typeof value === "string" && /^\/api\/uploads\/[0-9a-f-]{36}$/.test(value) ? value : null;
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
