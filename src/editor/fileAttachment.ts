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
    return [
      "div",
      mergeAttributes({
        "data-file-attachment": "",
        "data-url": HTMLAttributes.url,
        "data-name": name,
        "data-size": size,
        class: "file-attachment",
      }),
      ["a", { href: HTMLAttributes.url, download: name },
        ["span", { class: "file-attachment-name" }, name],
        ["span", { class: "file-attachment-size" }, formatBytes(size)],
      ],
    ];
  },

  renderText({ node }) {
    return String(node.attrs.name || "Attachment");
  },
});

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
