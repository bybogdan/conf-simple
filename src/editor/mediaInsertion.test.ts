import { Editor } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import type { UploadedFile } from "../types";
import { FileAttachment } from "./fileAttachment";
import { insertUploadedMedia } from "./mediaInsertion";

const editors: Editor[] = [];

afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

function createEditor() {
  const editor = new Editor({
    extensions: [StarterKit, Image, FileAttachment],
    content: { type: "doc", content: [{ type: "paragraph" }] },
  });
  editors.push(editor);
  return editor;
}

function upload(id: string, isImage: boolean): UploadedFile {
  return {
    id,
    pageId: "page-id",
    originalName: isImage ? `${id}.png` : `${id}.txt`,
    mimeType: isImage ? "image/png" : "text/plain",
    size: 42,
    url: `/api/uploads/${id}`,
    isImage,
  };
}

describe("uploaded media insertion", () => {
  it("moves the text selection after an image so a following file appends", () => {
    const editor = createEditor();

    expect(insertUploadedMedia(editor, upload("image-one", true))).toBe(true);
    expect(editor.state.selection.constructor.name).toBe("TextSelection");
    expect(insertUploadedMedia(editor, upload("file-two", false))).toBe(true);

    expect(editor.getJSON().content?.map((node) => node.type)).toEqual(["image", "fileAttachment", "paragraph"]);
  });

  it("appends every item from a multi-file sequence without replacing atoms", () => {
    const editor = createEditor();

    insertUploadedMedia(editor, upload("image-one", true));
    insertUploadedMedia(editor, upload("image-two", true));
    insertUploadedMedia(editor, upload("file-three", false));

    expect(editor.getJSON().content?.map((node) => node.type)).toEqual(["image", "image", "fileAttachment", "paragraph"]);
    expect(editor.state.selection.constructor.name).toBe("TextSelection");
  });
});
