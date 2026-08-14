export type RichDocument = { type: string; content?: Array<Record<string, unknown>> } & Record<string, unknown>;

export type User = { id: string; email: string; displayName: string };
export type Workspace = { id: string; name: string; role: "admin" | "member" };
export type Page = {
  id: string;
  parentId: string | null;
  title: string;
  content: RichDocument;
  position: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type Bootstrap = {
  needsSetup: boolean;
  requiresAuth?: boolean;
  user?: User;
  workspace?: Workspace;
  pages?: Page[];
};

export type SearchResult = { id: string; title: string; snippet: string };

export type UploadedFile = {
  id: string;
  pageId: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  isImage: boolean;
};

export type PageRevision = {
  id: number;
  title: string;
  content: RichDocument;
  reason: "created" | "save" | "restore";
  createdAt: string;
  author: string;
};
