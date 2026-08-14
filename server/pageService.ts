import { randomUUID } from "node:crypto";
import type { AppDatabase } from "./database.js";

export type PageRecord = {
  id: string;
  workspaceId: string;
  parentId: string | null;
  title: string;
  contentJson: string;
  position: number;
  version: number;
};

export function createPage(database: AppDatabase, input: {
  workspaceId: string;
  parentId: string | null;
  title: string;
  content: Record<string, unknown>;
  userId: string;
}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const contentJson = JSON.stringify(input.content);
  return database.transaction(() => {
    assertParent(database, input.workspaceId, input.parentId);
    const position = nextPosition(database, input.workspaceId, input.parentId);
    database.prepare(`
      INSERT INTO pages (id, workspace_id, parent_id, title, content_json, position, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.workspaceId, input.parentId, input.title, contentJson, position, input.userId, input.userId, now, now);
    insertRevision(database, id, input.title, contentJson, input.userId, "created", now);
    indexPage(database, id, input.workspaceId, input.title, input.content);
    return id;
  })();
}

export function savePage(database: AppDatabase, input: {
  pageId: string;
  workspaceId: string;
  title: string;
  content: Record<string, unknown>;
  version: number;
  userId: string;
}) {
  const now = new Date().toISOString();
  const contentJson = JSON.stringify(input.content);
  return database.transaction(() => {
    const result = database.prepare(`
      UPDATE pages SET title = ?, content_json = ?, updated_by = ?, updated_at = ?, version = version + 1
      WHERE id = ? AND workspace_id = ? AND version = ?
    `).run(input.title, contentJson, input.userId, now, input.pageId, input.workspaceId, input.version);
    if (result.changes === 0) return false;
    recordSavedRevision(database, input.pageId, input.title, contentJson, input.userId, now);
    indexPage(database, input.pageId, input.workspaceId, input.title, input.content);
    return true;
  })();
}

export function movePage(database: AppDatabase, input: {
  pageId: string;
  workspaceId: string;
  parentId: string | null;
  position?: number;
}) {
  return database.transaction(() => {
    const page = getPageRecord(database, input.pageId, input.workspaceId);
    if (!page) throw new PageHierarchyError("Page not found", 404);
    assertParent(database, input.workspaceId, input.parentId);
    if (input.parentId && isDescendant(database, input.pageId, input.parentId)) {
      throw new PageHierarchyError("A page cannot be moved inside itself or one of its descendants", 400);
    }
    if (page.parentId === input.parentId && input.position === undefined) return;

    const destinationIds = siblingIds(database, input.workspaceId, input.parentId, input.pageId);
    const insertionIndex = Math.max(0, Math.min(input.position ?? destinationIds.length, destinationIds.length));
    destinationIds.splice(insertionIndex, 0, input.pageId);

    database.prepare("UPDATE pages SET parent_id = ?, position = ? WHERE id = ?")
      .run(input.parentId, insertionIndex, input.pageId);
    normalizeSiblings(database, page.workspaceId, page.parentId, page.id);
    destinationIds.forEach((id, position) => database.prepare("UPDATE pages SET position = ? WHERE id = ?").run(position, id));
  })();
}

export function deletePageTree(database: AppDatabase, pageId: string, workspaceId: string) {
  return database.transaction(() => {
    const page = getPageRecord(database, pageId, workspaceId);
    if (!page) throw new PageHierarchyError("Page not found", 404);
    const ids = database.prepare(`
      WITH RECURSIVE subtree(id) AS (
        SELECT id FROM pages WHERE id = ? AND workspace_id = ?
        UNION ALL
        SELECT pages.id FROM pages JOIN subtree ON pages.parent_id = subtree.id
      ) SELECT id FROM subtree
    `).all(pageId, workspaceId).map((row) => (row as { id: string }).id);
    const placeholders = ids.map(() => "?").join(",");
    database.prepare(`DELETE FROM page_search WHERE page_id IN (${placeholders})`).run(...ids);
    database.prepare(`DELETE FROM pages WHERE id IN (${placeholders})`).run(...ids);
    normalizeSiblings(database, workspaceId, page.parentId);
    return ids;
  })();
}

export function searchPages(database: AppDatabase, workspaceId: string, query: string) {
  const ftsQuery = query.trim().split(/\s+/).map((word) => `"${word.replaceAll('"', '""')}"*`).join(" AND ");
  if (!ftsQuery) return [];
  return database.prepare(`
    SELECT page_id AS id, title,
      snippet(page_search, 3, '', '', ' … ', 18) AS snippet
    FROM page_search
    WHERE workspace_id = ? AND page_search MATCH ?
    ORDER BY bm25(page_search, 4.0, 1.0)
    LIMIT 30
  `).all(workspaceId, ftsQuery) as Array<{ id: string; title: string; snippet: string }>;
}

export function listRevisions(database: AppDatabase, pageId: string, workspaceId: string) {
  return database.prepare(`
    SELECT page_revisions.id, page_revisions.title, page_revisions.content_json AS contentJson,
      page_revisions.reason, page_revisions.created_at AS createdAt,
      COALESCE(users.display_name, 'Unknown user') AS author
    FROM page_revisions
    JOIN pages ON pages.id = page_revisions.page_id
    LEFT JOIN users ON users.id = page_revisions.author_id
    WHERE page_revisions.page_id = ? AND pages.workspace_id = ?
    ORDER BY page_revisions.created_at DESC, page_revisions.id DESC
  `).all(pageId, workspaceId).map((row) => deserializeRevision(row as Record<string, unknown>));
}

export function restoreRevision(database: AppDatabase, input: {
  pageId: string;
  revisionId: number;
  workspaceId: string;
  version: number;
  userId: string;
}) {
  return database.transaction(() => {
    const revision = database.prepare(`
      SELECT page_revisions.title, page_revisions.content_json AS contentJson
      FROM page_revisions JOIN pages ON pages.id = page_revisions.page_id
      WHERE page_revisions.id = ? AND page_revisions.page_id = ? AND pages.workspace_id = ?
    `).get(input.revisionId, input.pageId, input.workspaceId) as { title: string; contentJson: string } | undefined;
    if (!revision) throw new PageHierarchyError("Revision not found", 404);
    const now = new Date().toISOString();
    const updated = database.prepare(`
      UPDATE pages SET title = ?, content_json = ?, updated_by = ?, updated_at = ?, version = version + 1
      WHERE id = ? AND workspace_id = ? AND version = ?
    `).run(revision.title, revision.contentJson, input.userId, now, input.pageId, input.workspaceId, input.version);
    if (updated.changes === 0) throw new PageHierarchyError("This page changed in another session. Reload before restoring.", 409);
    insertRevision(database, input.pageId, revision.title, revision.contentJson, input.userId, "restore", now);
    indexPage(database, input.pageId, input.workspaceId, revision.title, JSON.parse(revision.contentJson));
  })();
}

function getPageRecord(database: AppDatabase, pageId: string, workspaceId: string) {
  return database.prepare(`
    SELECT id, workspace_id AS workspaceId, parent_id AS parentId, title, content_json AS contentJson, position, version
    FROM pages WHERE id = ? AND workspace_id = ?
  `).get(pageId, workspaceId) as PageRecord | undefined;
}

function assertParent(database: AppDatabase, workspaceId: string, parentId: string | null) {
  if (!parentId) return;
  const parent = database.prepare("SELECT id FROM pages WHERE id = ? AND workspace_id = ?").get(parentId, workspaceId);
  if (!parent) throw new PageHierarchyError("Parent page does not exist", 400);
}

function isDescendant(database: AppDatabase, pageId: string, candidateId: string) {
  return Boolean(database.prepare(`
    WITH RECURSIVE subtree(id) AS (
      SELECT id FROM pages WHERE id = ?
      UNION ALL
      SELECT pages.id FROM pages JOIN subtree ON pages.parent_id = subtree.id
    ) SELECT 1 FROM subtree WHERE id = ? LIMIT 1
  `).get(pageId, candidateId));
}

function nextPosition(database: AppDatabase, workspaceId: string, parentId: string | null) {
  return (database.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS value FROM pages WHERE workspace_id = ? AND parent_id IS ?")
    .get(workspaceId, parentId) as { value: number }).value;
}

function siblingIds(database: AppDatabase, workspaceId: string, parentId: string | null, excludingId?: string) {
  return database.prepare(`
    SELECT id FROM pages WHERE workspace_id = ? AND parent_id IS ? ${excludingId ? "AND id != ?" : ""}
    ORDER BY position, created_at
  `).all(...(excludingId ? [workspaceId, parentId, excludingId] : [workspaceId, parentId]))
    .map((row) => (row as { id: string }).id);
}

function normalizeSiblings(database: AppDatabase, workspaceId: string, parentId: string | null, excludingId?: string) {
  siblingIds(database, workspaceId, parentId, excludingId)
    .forEach((id, position) => database.prepare("UPDATE pages SET position = ? WHERE id = ?").run(position, id));
}

function indexPage(database: AppDatabase, pageId: string, workspaceId: string, title: string, content: unknown) {
  database.prepare("DELETE FROM page_search WHERE page_id = ?").run(pageId);
  database.prepare("INSERT INTO page_search (page_id, workspace_id, title, content) VALUES (?, ?, ?, ?)")
    .run(pageId, workspaceId, title, documentText(content));
}

function documentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(documentText).filter(Boolean).join(" ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [record.text, record.content].map(documentText).filter(Boolean).join(" ");
  }
  return "";
}

function recordSavedRevision(database: AppDatabase, pageId: string, title: string, contentJson: string, userId: string, now: string) {
  const latest = database.prepare(`
    SELECT id, author_id AS authorId, reason, created_at AS createdAt
    FROM page_revisions WHERE page_id = ? ORDER BY created_at DESC, id DESC LIMIT 1
  `).get(pageId) as { id: number; authorId: string | null; reason: string; createdAt: string } | undefined;
  const withinWindow = latest && Date.parse(now) - Date.parse(latest.createdAt) < 10 * 60 * 1000;
  if (latest && latest.reason === "save" && latest.authorId === userId && withinWindow) {
    database.prepare("UPDATE page_revisions SET title = ?, content_json = ?, created_at = ? WHERE id = ?")
      .run(title, contentJson, now, latest.id);
    return;
  }
  insertRevision(database, pageId, title, contentJson, userId, "save", now);
}

function insertRevision(database: AppDatabase, pageId: string, title: string, contentJson: string, userId: string, reason: "created" | "save" | "restore", now: string) {
  database.prepare(`
    INSERT INTO page_revisions (page_id, title, content_json, author_id, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(pageId, title, contentJson, userId, reason, now);
}

function deserializeRevision(row: Record<string, unknown>) {
  const { contentJson, ...revision } = row;
  return { ...revision, content: JSON.parse(contentJson as string) };
}

export class PageHierarchyError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
