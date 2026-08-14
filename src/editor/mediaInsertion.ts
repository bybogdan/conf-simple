import type { Editor } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";
import type { UploadedFile } from "../types";

export function insertUploadedMedia(editor: Editor, upload: UploadedFile) {
  const node = upload.isImage
    ? { type: "image", attrs: { src: upload.url, alt: upload.originalName, title: upload.originalName } }
    : { type: "fileAttachment", attrs: { url: upload.url, name: upload.originalName, size: upload.size } };

  return editor.chain().insertContent(node).command(({ tr }) => {
    const insertionEnd = tr.selection.to;
    let nextSelection = Selection.findFrom(tr.doc.resolve(insertionEnd), 1, true);
    if (!nextSelection) {
      const paragraph = tr.doc.type.schema.nodes.paragraph;
      if (!paragraph) return true;
      tr.insert(insertionEnd, paragraph.create());
      nextSelection = Selection.findFrom(tr.doc.resolve(insertionEnd), 1, true);
    }
    if (nextSelection) tr.setSelection(nextSelection);
    return true;
  }).run();
}
