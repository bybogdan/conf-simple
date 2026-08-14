import express, { type Request, type Response } from "express";
import helmet from "helmet";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AppDatabase } from "./database.js";
import { createSession, deleteSession, getSessionUser, hashPassword, verifyPassword } from "./auth.js";
import {
  createPage,
  deletePageTree,
  listRevisions,
  movePage,
  PageHierarchyError,
  restoreRevision,
  savePage,
  searchPages,
} from "./pageService.js";
import { contentDispositionFilename, LocalUploadStorage, MAX_UPLOAD_BYTES, UploadError, validateUpload } from "./storage.js";

const setupSchema = z.object({
  workspaceName: z.string().trim().min(2).max(80),
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(200),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });
const createPageSchema = z.object({
  title: z.string().trim().min(1).max(180),
  parentId: z.string().uuid().nullable().optional(),
  content: z.record(z.string(), z.unknown()).optional(),
});
const updatePageSchema = z.object({
  title: z.string().trim().min(1).max(180),
  content: z.record(z.string(), z.unknown()),
  version: z.number().int().positive(),
});
const movePageSchema = z.object({
  parentId: z.string().uuid().nullable(),
  position: z.number().int().nonnegative().optional(),
});
const restoreRevisionSchema = z.object({ version: z.number().int().positive() });

type SessionUser = NonNullable<ReturnType<typeof getSessionUser>>;

export function createApp(database: AppDatabase, options: { clientDirectory?: string; secureCookies?: boolean; dataDirectory?: string } = {}) {
  const app = express();
  const uploadStorage = new LocalUploadStorage(options.dataDirectory ?? path.dirname(database.name));
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));

  app.use("/api", (request, response, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !hasSafeOrigin(request)) {
      response.status(403).json({ error: "Invalid request origin" });
      return;
    }
    next();
  });

  app.post(
    "/api/pages/:pageId/uploads",
    express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }),
    requireUser(database, (request, response, user) => {
      const workspace = memberWorkspace(database, user.id);
      if (!workspace) return response.status(403).json({ error: "Workspace membership required" });
      const pageId = String(request.params.pageId);
      const page = database.prepare("SELECT id FROM pages WHERE id = ? AND workspace_id = ?").get(pageId, workspace.id);
      if (!page) return response.status(404).json({ error: "Page not found" });

      const upload = validateUpload(request.body, request.get("content-type"), request.get("x-file-name"));
      const storageName = uploadStorage.write(upload);
      const id = randomUUID();
      try {
        database.prepare(`
          INSERT INTO uploads (id, workspace_id, page_id, uploaded_by, original_name, storage_name, mime_type, size_bytes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, workspace.id, pageId, user.id, upload.originalName, storageName, upload.mimeType, upload.bytes.length, new Date().toISOString());
      } catch (error) {
        uploadStorage.remove(storageName);
        throw error;
      }
      return response.status(201).json(uploadPayload({ id, pageId, originalName: upload.originalName, mimeType: upload.mimeType, size: upload.bytes.length }));
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => response.json({ ok: true }));

  app.get("/api/bootstrap", (request, response) => {
    const needsSetup = Number((database.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count) === 0;
    if (needsSetup) return response.json({ needsSetup: true });
    const user = currentUser(database, request);
    if (!user) return response.json({ needsSetup: false, requiresAuth: true });
    return response.json({ needsSetup: false, requiresAuth: false, ...workspacePayload(database, user) });
  });

  app.post("/api/setup", async (request, response, next) => {
    try {
      const input = setupSchema.parse(request.body);
      const passwordHash = await hashPassword(input.password);
      const now = new Date().toISOString();
      const userId = randomUUID();
      const workspaceId = randomUUID();
      database.transaction(() => {
        const count = (database.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count;
        if (count > 0) throw new SetupCompleteError();
        database
          .prepare("INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
          .run(userId, input.email, input.displayName, passwordHash, now);
        database.prepare("INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)").run(workspaceId, input.workspaceName, now);
        database
          .prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'admin')")
          .run(workspaceId, userId);
      })();
      setSessionCookie(response, createSession(database, userId), options.secureCookies);
      response.status(201).json(workspacePayload(database, { id: userId, email: input.email, displayName: input.displayName }));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", async (request, response, next) => {
    try {
      const input = loginSchema.parse(request.body);
      const user = database
        .prepare("SELECT id, email, display_name AS displayName, password_hash AS passwordHash FROM users WHERE email = ?")
        .get(input.email) as (SessionUser & { passwordHash: string }) | undefined;
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        return response.status(401).json({ error: "Email or password is incorrect" });
      }
      setSessionCookie(response, createSession(database, user.id), options.secureCookies);
      return response.json(workspacePayload(database, user));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/logout", (request, response) => {
    deleteSession(database, readCookie(request, "conf_session"));
    response.clearCookie("conf_session", { path: "/" });
    response.status(204).end();
  });

  app.post("/api/pages", requireUser(database, (request, response, user) => {
    const input = createPageSchema.parse(request.body);
    const workspace = memberWorkspace(database, user.id);
    if (!workspace) return response.status(403).json({ error: "Workspace membership required" });
    const content = input.content ?? emptyDocument();
    const id = createPage(database, {
      workspaceId: workspace.id,
      parentId: input.parentId ?? null,
      title: input.title,
      content,
      userId: user.id,
    });
    return response.status(201).json(pageById(database, id));
  }));

  app.put("/api/pages/:id", requireUser(database, (request, response, user) => {
    const input = updatePageSchema.parse(request.body);
    const pageId = String(request.params.id);
    const workspace = memberWorkspace(database, user.id);
    if (!workspace) return response.status(403).json({ error: "Workspace membership required" });
    const saved = savePage(database, {
      pageId,
      workspaceId: workspace.id,
      title: input.title,
      content: input.content,
      version: input.version,
      userId: user.id,
    });
    if (!saved) {
      const exists = database.prepare("SELECT id FROM pages WHERE id = ? AND workspace_id = ?").get(pageId, workspace.id);
      return response.status(exists ? 409 : 404).json({ error: exists ? "This page changed in another session. Reload before saving." : "Page not found" });
    }
    return response.json(pageById(database, pageId));
  }));

  app.patch("/api/pages/:id/move", requireUser(database, (request, response, user) => {
    const input = movePageSchema.parse(request.body);
    const workspace = memberWorkspace(database, user.id);
    if (!workspace) return response.status(403).json({ error: "Workspace membership required" });
    movePage(database, { pageId: String(request.params.id), workspaceId: workspace.id, ...input });
    return response.json(workspacePayload(database, user).pages);
  }));

  app.delete("/api/pages/:id", requireUser(database, (request, response, user) => {
    const workspace = memberWorkspace(database, user.id);
    if (!workspace) return response.status(403).json({ error: "Workspace membership required" });
    const storedFiles = database.prepare(`
      WITH RECURSIVE subtree(id) AS (
        SELECT id FROM pages WHERE id = ? AND workspace_id = ?
        UNION ALL SELECT pages.id FROM pages JOIN subtree ON pages.parent_id = subtree.id
      ) SELECT storage_name AS storageName FROM uploads WHERE page_id IN (SELECT id FROM subtree)
    `).all(String(request.params.id), workspace.id) as Array<{ storageName: string }>;
    const deletedIds = deletePageTree(database, String(request.params.id), workspace.id);
    for (const file of storedFiles) uploadStorage.remove(file.storageName);
    return response.json({ deletedIds });
  }));

  app.get("/api/uploads/:id", requireUser(database, (request, response, user) => {
    const workspace = memberWorkspace(database, user.id);
    if (!workspace) return response.status(403).json({ error: "Workspace membership required" });
    const upload = database.prepare(`
      SELECT storage_name AS storageName, original_name AS originalName, mime_type AS mimeType
      FROM uploads WHERE id = ? AND workspace_id = ?
    `).get(String(request.params.id), workspace.id) as { storageName: string; originalName: string; mimeType: string } | undefined;
    if (!upload) return response.status(404).json({ error: "File not found" });
    response.setHeader("Content-Type", upload.mimeType);
    response.setHeader("Cache-Control", "private, max-age=3600");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (!upload.mimeType.startsWith("image/")) response.setHeader("Content-Disposition", contentDispositionFilename(upload.originalName));
    return response.sendFile(uploadStorage.resolve(upload.storageName));
  }));

  app.delete("/api/uploads/:id", requireUser(database, (request, response, user) => {
    const workspace = memberWorkspace(database, user.id);
    if (!workspace) return response.status(403).json({ error: "Workspace membership required" });
    const upload = database.prepare(`
      SELECT storage_name AS storageName FROM uploads WHERE id = ? AND workspace_id = ?
    `).get(String(request.params.id), workspace.id) as { storageName: string } | undefined;
    if (!upload) return response.status(404).json({ error: "File not found" });
    const reference = `%/api/uploads/${String(request.params.id)}%`;
    const isReferenced = database.prepare(`
      SELECT 1 FROM pages WHERE workspace_id = ? AND content_json LIKE ?
      UNION ALL
      SELECT 1 FROM page_revisions
      JOIN pages ON pages.id = page_revisions.page_id
      WHERE pages.workspace_id = ? AND page_revisions.content_json LIKE ?
      LIMIT 1
    `).get(workspace.id, reference, workspace.id, reference);
    if (isReferenced) return response.status(409).json({ error: "Remove this file from the page before deleting it" });
    database.prepare("DELETE FROM uploads WHERE id = ? AND workspace_id = ?").run(String(request.params.id), workspace.id);
    uploadStorage.remove(upload.storageName);
    return response.status(204).end();
  }));

  app.get("/api/search", requireUser(database, (request, response, user) => {
    const workspace = memberWorkspace(database, user.id);
    if (!workspace) return response.status(403).json({ error: "Workspace membership required" });
    const query = z.string().trim().max(180).parse(request.query.q ?? "");
    return response.json(query ? searchPages(database, workspace.id, query) : []);
  }));

  app.get("/api/pages/:id/revisions", requireUser(database, (request, response, user) => {
    const workspace = memberWorkspace(database, user.id);
    if (!workspace) return response.status(403).json({ error: "Workspace membership required" });
    const pageId = String(request.params.id);
    const page = database.prepare("SELECT id FROM pages WHERE id = ? AND workspace_id = ?").get(pageId, workspace.id);
    if (!page) return response.status(404).json({ error: "Page not found" });
    return response.json(listRevisions(database, pageId, workspace.id));
  }));

  app.post("/api/pages/:id/revisions/:revisionId/restore", requireUser(database, (request, response, user) => {
    const input = restoreRevisionSchema.parse(request.body);
    const workspace = memberWorkspace(database, user.id);
    if (!workspace) return response.status(403).json({ error: "Workspace membership required" });
    const revisionId = z.coerce.number().int().positive().parse(request.params.revisionId);
    const pageId = String(request.params.id);
    restoreRevision(database, { pageId, revisionId, workspaceId: workspace.id, version: input.version, userId: user.id });
    return response.json(pageById(database, pageId));
  }));

  app.use((error: unknown, _request: Request, response: Response, _next: express.NextFunction) => {
    if (error instanceof UploadError) return response.status(error.status).json({ error: error.message });
    if ((error as { type?: string }).type === "entity.too.large") return response.status(413).json({ error: "Files must be 10 MB or smaller" });
    if (error instanceof z.ZodError) return response.status(400).json({ error: "Please check the submitted fields", details: error.issues });
    if (error instanceof SetupCompleteError) return response.status(409).json({ error: "Setup has already been completed" });
    if (error instanceof PageHierarchyError) return response.status(error.status).json({ error: error.message });
    console.error(error);
    return response.status(500).json({ error: "Unexpected server error" });
  });

  if (options.clientDirectory) {
    app.use(express.static(options.clientDirectory, { index: false }));
    app.get("/{*path}", (_request, response) => response.sendFile(path.join(options.clientDirectory!, "index.html")));
  }
  return app;
}

function workspacePayload(database: AppDatabase, user: SessionUser) {
  const workspace = memberWorkspace(database, user.id);
  if (!workspace) throw new Error("User has no workspace");
  const pages = database.prepare(`
    SELECT pages.id, pages.parent_id AS parentId, pages.title, pages.content_json AS contentJson,
      pages.position, pages.version, pages.created_at AS createdAt, pages.updated_at AS updatedAt,
      users.display_name AS updatedBy
    FROM pages JOIN users ON users.id = pages.updated_by
    WHERE pages.workspace_id = ? ORDER BY pages.position, pages.created_at
  `).all(workspace.id).map((row) => deserializePage(row as Record<string, unknown>));
  return { user, workspace, pages };
}

function memberWorkspace(database: AppDatabase, userId: string) {
  return database.prepare(`
    SELECT workspaces.id, workspaces.name, workspace_members.role
    FROM workspace_members JOIN workspaces ON workspaces.id = workspace_members.workspace_id
    WHERE workspace_members.user_id = ? LIMIT 1
  `).get(userId) as { id: string; name: string; role: "admin" | "member" } | undefined;
}

function pageById(database: AppDatabase, id: string) {
  const row = database.prepare(`
    SELECT pages.id, pages.parent_id AS parentId, pages.title, pages.content_json AS contentJson,
      pages.position, pages.version, pages.created_at AS createdAt, pages.updated_at AS updatedAt,
      users.display_name AS updatedBy
    FROM pages JOIN users ON users.id = pages.updated_by WHERE pages.id = ?
  `).get(id);
  return deserializePage(row as Record<string, unknown>);
}

function deserializePage(row: Record<string, unknown>) {
  const { contentJson, ...page } = row;
  return { ...page, content: JSON.parse(contentJson as string) };
}

function requireUser(database: AppDatabase, handler: (request: Request, response: Response, user: SessionUser) => unknown) {
  return (request: Request, response: Response, next: express.NextFunction) => {
    try {
      const user = currentUser(database, request);
      if (!user) return response.status(401).json({ error: "Authentication required" });
      return handler(request, response, user);
    } catch (error) {
      next(error);
    }
  };
}

function uploadPayload(upload: { id: string; pageId: string; originalName: string; mimeType: string; size: number }) {
  return { ...upload, url: `/api/uploads/${upload.id}`, isImage: upload.mimeType.startsWith("image/") };
}

function currentUser(database: AppDatabase, request: Request) {
  return getSessionUser(database, readCookie(request, "conf_session"));
}

function readCookie(request: Request, name: string) {
  const cookies = request.headers.cookie?.split(";").map((part) => part.trim().split("=")) ?? [];
  const value = cookies.find(([key]) => key === name)?.[1];
  return value ? decodeURIComponent(value) : undefined;
}

function setSessionCookie(response: Response, session: { token: string; expires: Date }, secure = false) {
  response.cookie("conf_session", session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    expires: session.expires,
    path: "/",
  });
}

function hasSafeOrigin(request: Request) {
  const origin = request.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.get("host");
  } catch {
    return false;
  }
}

function emptyDocument() {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

class SetupCompleteError extends Error {}
