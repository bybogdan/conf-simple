import type { Extensions } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import { FileAttachment } from "./fileAttachment";
import { isSafeLinkHref } from "./links";

export function createEditorExtensions(): Extensions {
  return [
    StarterKit.configure({ link: false }),
    Link.configure({
      openOnClick: true,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: "https",
      protocols: ["http", "https", "mailto"],
      isAllowedUri: (url) => isSafeLinkHref(url),
      HTMLAttributes: { class: "document-link", rel: "noopener noreferrer", target: null },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Image.configure({ allowBase64: false, HTMLAttributes: { class: "document-image" } }),
    FileAttachment,
    TableKit,
  ];
}
