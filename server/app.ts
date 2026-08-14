import express, { type Request, type Response } from "express";
import helmet from "helmet";
import path from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
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
const workspaceSchema = z.object({ name: z.string().trim().min(2).max(80) });
const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["admin", "member"]).default("member"),
});
const acceptInvitationSchema = z.object({
  token: z.string().min(20).max(200),
  displayName: z.string().trim().min(2).max(80),
  password: z.string().min(10).max(200),
});
const memberRoleSchema = z.object({ role: z.enum(["admin", "member"]) });

const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

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
    if (!memberWorkspace(database, user.id)) {
      deleteSession(database, readCookie(request, "conf_session"));
      return response.json({ needsSetup: false, requiresAuth: true });
    }
    return response.json({ needsSetup: false, requiresAuth: false, ...workspacePayload(database, user) });
  });

  app.get("/api/invitations/:token", (request, response) => {
    const invitation = invitationByToken(database, String(request.params.token));
    if (!invitation) return response.status(404).json({ error: "This invitation is invalid or has already been used" });
    if (invitation.expiresAt <= new Date().toISOString()) return response.status(410).json({ error: "This invitation has expired. Ask an admin for a new link." });
    const existing = database.prepare("SELECT id, display_name AS displayName FROM users WHERE email = ?").get(invitation.email) as { id: string; displayName: string } | undefined;
    return response.json({ workspaceName: invitation.workspaceName, email: invitation.email, role: invitation.role, accountExists: Boolean(existing), displayName: existing?.displayName });
  });

  app.post("/api/invitations/accept", async (request, response, next) => {
    try {
      const input = acceptInvitationSchema.parse(request.body);
      const invitation = invitationByToken(database, input.token);
      if (!invitation) return response.status(404).json({ error: "This invitation is invalid or has already been used" });
      if (invitation.expiresAt <= new Date().toISOString()) return response.status(410).json({ error: "This invitation has expired. Ask an admin for a new link." });

      const existing = database.prepare("SELECT id, password_hash AS passwordHash FROM users WHERE email = ?").get(invitation.email) as { id: string; passwordHash: string } | undefined;
      if (existing && !(await verifyPassword(input.password, existing.passwordHash))) {
        return response.status(401).json({ error: "Enter the password for your existing account" });
      }
      const userId = existing?.id ?? randomUUID();
      const passwordHash = existing ? null : await hashPassword(input.password);
      database.transaction(() => {
        if (!invitationByToken(database, input.token)) throw new InvitationUsedError();
        if (!existing) {
          database.prepare("INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
            .run(userId, invitation.email, input.displayName, passwordHash, new Date().toISOString());
        }
        database.prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)")
          .run(invitation.workspaceId, userId, invitation.role);
        database.prepare("DELETE FROM workspace_invitations WHERE token_hash = ?").run(hashInvitationToken(input.token));
      })();
      const acceptedUser = database.prepare("SELECT id, email, display_name AS displayName FROM users WHERE id = ?").get(userId) as SessionUser;
      setSessionCookie(response, createSession(database, userId), options.secureCookies);
      return response.status(201).json(workspacePayload(database, acceptedUser));
    } catch (error) {
      next(error);
    }
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
      if (!memberWorkspace(database, user.id)) return response.status(403).json({ error: "This account is not a workspace member" });
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

  app.get("/api/members", requireUser(database, (_request, response, user) => {
    const workspace = memberWorkspace(database, user.id);
    if (!workspace) return response.status(403).json({ error: "Workspace membership required" });
    const members = database.prepare(`
      SELECT users.id, users.email, users.display_name AS displayName, workspace_members.role,
        users.created_at AS joinedAt
      FROM workspace_members JOIN users ON users.id = workspace_members.user_id
      WHERE workspace_members.workspace_id = ?
      ORDER BY CASE workspace_members.role WHEN 'admin' THEN 0 ELSE 1 END, users.display_name COLLATE NOCASE
    `).all(workspace.id);
    return response.json(members);
  }));

  app.post("/api/invitations", requireUser(database, (request, response, user) => {
    const input = invitationSchema.parse(request.body);
    const workspace = adminWorkspace(database, user.id);
    if (!workspace) return response.status(403).json({ error: "Admin access required" });
    const existingMember = database.prepare(`
      SELECT 1 FROM users JOIN workspace_members ON workspace_members.user_id = users.id
      WHERE users.email = ? AND workspace_members.workspace_id = ?
    `).get(input.email, workspace.id);
    if (existingMember) return response.status(409).json({ error: "This person is already a member" });
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS).toISOString();
    database.prepare(`
      INSERT INTO workspace_invitations (token_hash, workspace_id, email, role, invited_by, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, email) DO UPDATE SET token_hash = excluded.token_hash, role = excluded.role,
        invited_by = excluded.invited_by, expires_at = excluded.expires_at, created_at = excluded.created_at
    `).run(hashInvitationToken(token), workspace.id, input.email, input.role, user.id, expiresAt, now.toISOString());
    return response.status(201).json({ token, email: input.email, role: input.role, expiresAt });
  }));

  app.patch("/api/members/:id", requireUser(database, (request, response, user) => {
    const input = memberRoleSchema.parse(request.body);
    const workspace = adminWorkspace(database, user.id);
    if (!workspace) return response.status(403).json({ error: "Admin access required" });
    const memberId = String(request.params.id);
    const target = database.prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?").get(workspace.id, memberId) as { role: "admin" | "member" } | undefined;
    if (!target) return response.status(404).json({ error: "Member not found" });
    if (memberId === user.id && input.role !== target.role) {
      return response.status(409).json({ error: "Ask another admin to change your role" });
    }
    if (target.role === "admin" && input.role === "member" && adminCount(database, workspace.id) === 1) {
      return response.status(409).json({ error: "Promote another admin before changing the last admin’s role" });
    }
    database.prepare("UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?").run(input.role, workspace.id, memberId);
    return response.json({ id: memberId, role: input.role });
  }));

  app.delete("/api/members/:id", requireUser(database, (request, response, user) => {
    const workspace = adminWorkspace(database, user.id);
    if (!workspace) return response.status(403).json({ error: "Admin access required" });
    const memberId = String(request.params.id);
    if (memberId === user.id) return response.status(409).json({ error: "You cannot remove your own account" });
    const target = database.prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?").get(workspace.id, memberId) as { role: "admin" | "member" } | undefined;
    if (!target) return response.status(404).json({ error: "Member not found" });
    if (target.role === "admin" && adminCount(database, workspace.id) === 1) {
      return response.status(409).json({ error: "Promote another admin before removing the last admin" });
    }
    database.transaction(() => {
      database.prepare("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?").run(workspace.id, memberId);
      database.prepare("DELETE FROM sessions WHERE user_id = ?").run(memberId);
    })();
    return response.status(204).end();
  }));

  app.patch("/api/workspace", requireUser(database, (request, response, user) => {
    const input = workspaceSchema.parse(request.body);
    const workspace = adminWorkspace(database, user.id);
    if (!workspace) return response.status(403).json({ error: "Admin access required" });
    database.prepare("UPDATE workspaces SET name = ? WHERE id = ?").run(input.name, workspace.id);
    return response.json({ ...workspace, name: input.name });
  }));

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
    validateMediaReferences(database, input.content, pageId, workspace.id);
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
    if (error instanceof InvitationUsedError) return response.status(409).json({ error: "This invitation has already been used" });
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

function adminWorkspace(database: AppDatabase, userId: string) {
  const workspace = memberWorkspace(database, userId);
  return workspace?.role === "admin" ? workspace : undefined;
}

function adminCount(database: AppDatabase, workspaceId: string) {
  return Number((database.prepare("SELECT COUNT(*) AS count FROM workspace_members WHERE workspace_id = ? AND role = 'admin'").get(workspaceId) as { count: number }).count);
}

function invitationByToken(database: AppDatabase, token: string) {
  return database.prepare(`
    SELECT workspace_invitations.workspace_id AS workspaceId, workspace_invitations.email,
      workspace_invitations.role, workspace_invitations.expires_at AS expiresAt,
      workspaces.name AS workspaceName
    FROM workspace_invitations JOIN workspaces ON workspaces.id = workspace_invitations.workspace_id
    WHERE workspace_invitations.token_hash = ?
  `).get(hashInvitationToken(token)) as { workspaceId: string; workspaceName: string; email: string; role: "admin" | "member"; expiresAt: string } | undefined;
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
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

function validateMediaReferences(database: AppDatabase, content: Record<string, unknown>, pageId: string, workspaceId: string) {
  const references: Array<{ id: string; image: boolean }> = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (node.type === "image" || node.type === "fileAttachment") {
      const attrs = node.attrs && typeof node.attrs === "object" ? node.attrs as Record<string, unknown> : {};
      const url = node.type === "image" ? attrs.src : attrs.url;
      const match = typeof url === "string" ? /^\/api\/uploads\/([0-9a-f-]{36})$/.exec(url) : null;
      if (!match) throw new UploadError("Invalid file reference");
      references.push({ id: match[1], image: node.type === "image" });
    }
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  visit(content);

  for (const reference of references) {
    const upload = database.prepare(`
      SELECT mime_type AS mimeType FROM uploads
      WHERE id = ? AND page_id = ? AND workspace_id = ?
    `).get(reference.id, pageId, workspaceId) as { mimeType: string } | undefined;
    if (!upload || (reference.image && !upload.mimeType.startsWith("image/"))) {
      throw new UploadError("Invalid file reference");
    }
  }
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
class InvitationUsedError extends Error {}
