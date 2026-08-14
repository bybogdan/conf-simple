import type { Bootstrap, Page, PageRevision, RichDocument, SearchResult, UploadedFile } from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Request failed");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  bootstrap: () => request<Bootstrap>("/api/bootstrap"),
  setup: (input: { workspaceName: string; displayName: string; email: string; password: string }) =>
    request<Required<Omit<Bootstrap, "needsSetup" | "requiresAuth">>>("/api/setup", { method: "POST", body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) =>
    request<Required<Omit<Bootstrap, "needsSetup" | "requiresAuth">>>("/api/login", { method: "POST", body: JSON.stringify(input) }),
  logout: () => request<void>("/api/logout", { method: "POST" }),
  createPage: (input: { title: string; parentId?: string | null; content?: RichDocument }) =>
    request<Page>("/api/pages", { method: "POST", body: JSON.stringify(input) }),
  updatePage: (id: string, input: { title: string; content: RichDocument; version: number }) =>
    request<Page>(`/api/pages/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  movePage: (id: string, input: { parentId: string | null; position?: number }) =>
    request<Page[]>(`/api/pages/${id}/move`, { method: "PATCH", body: JSON.stringify(input) }),
  deletePage: (id: string) =>
    request<{ deletedIds: string[] }>(`/api/pages/${id}`, { method: "DELETE" }),
  search: (query: string) => request<SearchResult[]>(`/api/search?q=${encodeURIComponent(query)}`),
  revisions: (id: string) => request<PageRevision[]>(`/api/pages/${id}/revisions`),
  restoreRevision: (pageId: string, revisionId: number, version: number) =>
    request<Page>(`/api/pages/${pageId}/revisions/${revisionId}/restore`, { method: "POST", body: JSON.stringify({ version }) }),
  uploadFile: async (pageId: string, file: File) => {
    const mimeType = file.type || mimeTypeFromName(file.name);
    const response = await fetch(`/api/pages/${pageId}/uploads`, {
      method: "POST",
      headers: { "Content-Type": mimeType, "X-File-Name": encodeURIComponent(file.name) },
      body: file,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Upload failed");
    }
    return response.json() as Promise<UploadedFile>;
  },
  deleteUpload: (id: string) => request<void>(`/api/uploads/${id}`, { method: "DELETE" }),
};

function mimeTypeFromName(name: string) {
  const extension = name.toLowerCase().split(".").pop();
  return ({
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
    pdf: "application/pdf", zip: "application/zip", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json",
  } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
}
