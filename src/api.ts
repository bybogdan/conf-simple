import type { Bootstrap, Page, PageRevision, RichDocument, SearchResult } from "./types";

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
};
