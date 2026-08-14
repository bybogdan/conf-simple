import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const fileTypes: Record<string, { extension: string; disposition: "inline" | "attachment" }> = {
  "image/png": { extension: ".png", disposition: "inline" },
  "image/jpeg": { extension: ".jpg", disposition: "inline" },
  "image/gif": { extension: ".gif", disposition: "inline" },
  "image/webp": { extension: ".webp", disposition: "inline" },
  "application/pdf": { extension: ".pdf", disposition: "attachment" },
  "application/zip": { extension: ".zip", disposition: "attachment" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extension: ".docx", disposition: "attachment" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { extension: ".xlsx", disposition: "attachment" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { extension: ".pptx", disposition: "attachment" },
  "text/plain": { extension: ".txt", disposition: "attachment" },
  "text/markdown": { extension: ".md", disposition: "attachment" },
  "text/csv": { extension: ".csv", disposition: "attachment" },
  "application/json": { extension: ".json", disposition: "attachment" },
};

export type ValidatedUpload = {
  originalName: string;
  mimeType: string;
  extension: string;
  disposition: "inline" | "attachment";
  bytes: Buffer;
};

export class UploadError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export class LocalUploadStorage {
  readonly directory: string;

  constructor(dataDirectory: string) {
    this.directory = path.resolve(dataDirectory, "uploads");
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
  }

  write(upload: ValidatedUpload) {
    const storageName = `${randomUUID()}${upload.extension}`;
    const destination = this.resolve(storageName);
    fs.writeFileSync(destination, upload.bytes, { flag: "wx", mode: 0o600 });
    return storageName;
  }

  remove(storageName: string) {
    try {
      fs.unlinkSync(this.resolve(storageName));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  resolve(storageName: string) {
    if (!/^[0-9a-f-]{36}\.[a-z0-9]+$/.test(storageName) || path.basename(storageName) !== storageName) {
      throw new UploadError("Invalid stored file name");
    }
    const resolved = path.resolve(this.directory, storageName);
    if (path.dirname(resolved) !== this.directory) throw new UploadError("Invalid stored file path");
    return resolved;
  }
}

export function validateUpload(body: unknown, declaredMime: string | undefined, encodedName: string | undefined): ValidatedUpload {
  if (!Buffer.isBuffer(body) || body.length === 0) throw new UploadError("Choose a non-empty file to upload");
  if (body.length > MAX_UPLOAD_BYTES) throw new UploadError("Files must be 10 MB or smaller", 413);

  const mimeType = (declaredMime ?? "").split(";", 1)[0].trim().toLowerCase();
  const type = fileTypes[mimeType];
  if (!type) throw new UploadError("This file type is not supported");
  if (!matchesContent(mimeType, body)) throw new UploadError("The file contents do not match its declared type");

  const originalName = safeOriginalName(encodedName);
  return { originalName, mimeType, extension: type.extension, disposition: type.disposition, bytes: body };
}

export function contentDispositionFilename(name: string) {
  const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "download";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

function safeOriginalName(encodedName: string | undefined) {
  let decoded = "";
  try { decoded = decodeURIComponent(encodedName ?? ""); } catch { throw new UploadError("Invalid file name"); }
  const name = path.basename(decoded).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!name || name === "." || name === ".." || name.length > 240) throw new UploadError("Invalid file name");
  return name;
}

function matchesContent(mimeType: string, bytes: Buffer) {
  if (mimeType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/gif") return ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"));
  if (mimeType === "image/webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (mimeType === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "application/zip" || mimeType.includes("openxmlformats")) {
    return bytes[0] === 0x50 && bytes[1] === 0x4b && [[0x03, 0x04], [0x05, 0x06], [0x07, 0x08]].some(([a, b]) => bytes[2] === a && bytes[3] === b);
  }
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    if (bytes.includes(0)) return false;
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (mimeType === "application/json") JSON.parse(bytes.toString("utf8"));
      return true;
    } catch { return false; }
  }
  return false;
}
