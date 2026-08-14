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

export function createApp(database: AppDatabase, options: { clientDirectory?: string; secureCookies?: boolean } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", (request, response, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !hasSafeOrigin(request)) {
      response.status(403).json({ error: "Invalid request origin" });
      return;
    }
    next();
  });

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
    const deletedIds = deletePageTree(database, String(request.params.id), workspace.id);
    return response.json({ deletedIds });
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
