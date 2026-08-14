import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { openDatabase, type AppDatabase } from "./database.js";
import { LocalUploadStorage, MAX_UPLOAD_BYTES, validateUpload } from "./storage.js";

const cleanup: Array<{ directory: string; database: AppDatabase }> = [];

afterEach(() => {
  for (const item of cleanup.splice(0)) {
    item.database.close();
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

function testApp(directory?: string) {
  const dataDirectory = directory ?? fs.mkdtempSync(path.join(os.tmpdir(), "conf-simple-"));
  const database = openDatabase(dataDirectory);
  cleanup.push({ directory: dataDirectory, database });
  return { app: createApp(database), dataDirectory, database };
}

async function setupAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  const response = await agent.post("/api/setup").send({
    workspaceName: "Acme Engineering",
    displayName: "Jane Chen",
    email: "jane@example.com",
    password: "a very safe password",
  });
  expect(response.status).toBe(201);
  return agent;
}

async function acceptInvite(app: ReturnType<typeof createApp>, admin: ReturnType<typeof request.agent>, input: { email: string; displayName: string; password: string; role?: "admin" | "member" }) {
  const invited = await admin.post("/api/invitations").send({ email: input.email, role: input.role ?? "member" });
  expect(invited.status).toBe(201);
  const agent = request.agent(app);
  const accepted = await agent.post("/api/invitations/accept").send({ token: invited.body.token, displayName: input.displayName, password: input.password });
  expect(accepted.status).toBe(201);
  return { agent, member: accepted.body.user, invitation: invited.body };
}

describe("first-run persistence slice", () => {
  it("starts in setup and allows setup only once", async () => {
    const { app } = testApp();
    expect((await request(app).get("/api/bootstrap")).body).toEqual({ needsSetup: true });
    const agent = await setupAgent(app);
    expect((await agent.get("/api/bootstrap")).body.workspace.name).toBe("Acme Engineering");
    expect((await request(app).post("/api/setup").send({
      workspaceName: "Second", displayName: "Other Admin", email: "other@example.com", password: "another safe password",
    })).status).toBe(409);
  });

  it("creates and updates a page with optimistic conflict protection", async () => {
    const { app } = testApp();
    const agent = await setupAgent(app);
    const created = await agent.post("/api/pages").send({ title: "Deployment" });
    expect(created.status).toBe(201);
    expect(created.body.version).toBe(1);

    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Persisted instructions" }] }] };
    const saved = await agent.put(`/api/pages/${created.body.id}`).send({ title: "Production deployment", content, version: 1 });
    expect(saved.status).toBe(200);
    expect(saved.body.version).toBe(2);

    const conflict = await agent.put(`/api/pages/${created.body.id}`).send({ title: "Stale edit", content, version: 1 });
    expect(conflict.status).toBe(409);
  });

  it("retains setup and page data after the database is reopened", async () => {
    const first = testApp();
    const agent = await setupAgent(first.app);
    const created = await agent.post("/api/pages").send({ title: "Runbook" });
    await agent.put(`/api/pages/${created.body.id}`).send({
      title: "Service runbook",
      version: 1,
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Survives restart" }] }] },
    });

    first.database.close();
    cleanup.splice(cleanup.findIndex((item) => item.database === first.database), 1);
    const reopened = openDatabase(first.dataDirectory);
    cleanup.push({ directory: first.dataDirectory, database: reopened });
    const app = createApp(reopened);
    const login = request.agent(app);
    expect((await login.post("/api/login").send({ email: "jane@example.com", password: "a very safe password" })).status).toBe(200);
    const bootstrap = await login.get("/api/bootstrap");
    expect(bootstrap.body.pages).toHaveLength(1);
    expect(bootstrap.body.pages[0]).toMatchObject({ title: "Service runbook", version: 2 });
    expect(bootstrap.body.pages[0].content.content[0].content[0].text).toBe("Survives restart");
  });
});

describe("nested page hierarchy and ordering", () => {
  it("persists several levels and rejects cyclic moves", async () => {
    const { app } = testApp();
    const agent = await setupAgent(app);
    const root = (await agent.post("/api/pages").send({ title: "Engineering" })).body;
    const child = (await agent.post("/api/pages").send({ title: "Deployment", parentId: root.id })).body;
    const grandchild = (await agent.post("/api/pages").send({ title: "Docker", parentId: child.id })).body;

    expect(child.parentId).toBe(root.id);
    expect(grandchild.parentId).toBe(child.id);
    const cycle = await agent.patch(`/api/pages/${root.id}/move`).send({ parentId: grandchild.id });
    expect(cycle.status).toBe(400);
    expect(cycle.body.error).toMatch(/descendants/);

    const bootstrap = await agent.get("/api/bootstrap");
    expect(bootstrap.body.pages.find((page: { id: string }) => page.id === grandchild.id).parentId).toBe(child.id);
  });

  it("reorders siblings, moves subtrees, and deletes a subtree without orphaning it", async () => {
    const { app, database } = testApp();
    const agent = await setupAgent(app);
    const first = (await agent.post("/api/pages").send({ title: "First" })).body;
    const second = (await agent.post("/api/pages").send({ title: "Second" })).body;
    const third = (await agent.post("/api/pages").send({ title: "Third" })).body;
    const child = (await agent.post("/api/pages").send({ title: "Child", parentId: first.id })).body;
    const grandchild = (await agent.post("/api/pages").send({ title: "Grandchild", parentId: child.id })).body;

    expect((await agent.patch(`/api/pages/${third.id}/move`).send({ parentId: null, position: 0 })).status).toBe(200);
    let roots = (await agent.get("/api/bootstrap")).body.pages.filter((page: { parentId: string | null }) => page.parentId === null);
    expect(roots.map((page: { title: string }) => page.title)).toEqual(["Third", "First", "Second"]);

    await agent.patch(`/api/pages/${first.id}/move`).send({ parentId: second.id });
    const moved = (await agent.get("/api/bootstrap")).body.pages;
    expect(moved.find((page: { id: string }) => page.id === first.id).parentId).toBe(second.id);
    expect(moved.find((page: { id: string }) => page.id === grandchild.id).parentId).toBe(child.id);

    const deleted = await agent.delete(`/api/pages/${first.id}`);
    expect(new Set(deleted.body.deletedIds)).toEqual(new Set([first.id, child.id, grandchild.id]));
    expect((database.prepare("SELECT COUNT(*) AS count FROM pages WHERE id IN (?, ?, ?)").get(first.id, child.id, grandchild.id) as { count: number }).count).toBe(0);
  });

  it("preserves sibling order when a move keeps the same parent without a position", async () => {
    const { app } = testApp();
    const agent = await setupAgent(app);
    const first = (await agent.post("/api/pages").send({ title: "First" })).body;
    await agent.post("/api/pages").send({ title: "Second" });

    const moved = await agent.patch(`/api/pages/${first.id}/move`).send({ parentId: null });

    expect(moved.status).toBe(200);
    expect(moved.body.filter((page: { parentId: string | null }) => page.parentId === null)
      .map((page: { title: string }) => page.title)).toEqual(["First", "Second"]);
  });
});

describe("SQLite page search", () => {
  it("indexes title and textual content across create, edit, move, and delete", async () => {
    const { app } = testApp();
    const agent = await setupAgent(app);
    const parent = (await agent.post("/api/pages").send({ title: "Operations" })).body;
    const page = (await agent.post("/api/pages").send({
      title: "Release runbook",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Deploy the lunar service safely" }] }] },
    })).body;
    expect((await agent.get("/api/search?q=lunar")).body.map((item: { id: string }) => item.id)).toContain(page.id);
    expect((await agent.get("/api/search?q=release")).body[0].id).toBe(page.id);

    const updated = await agent.put(`/api/pages/${page.id}`).send({
      title: "Rollback guide", version: 1,
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Recover the solar service" }] }] },
    });
    expect(updated.status).toBe(200);
    expect((await agent.get("/api/search?q=lunar")).body).toHaveLength(0);
    expect((await agent.get("/api/search?q=solar")).body[0].id).toBe(page.id);

    await agent.patch(`/api/pages/${page.id}/move`).send({ parentId: parent.id });
    expect((await agent.get("/api/search?q=rollback")).body[0].id).toBe(page.id);
    await agent.delete(`/api/pages/${page.id}`);
    expect((await agent.get("/api/search?q=solar")).body).toHaveLength(0);
  });
});

describe("page revision history", () => {
  it("coalesces rapid saves and restores by appending history", async () => {
    const { app } = testApp();
    const agent = await setupAgent(app);
    const created = (await agent.post("/api/pages").send({ title: "Original" })).body;
    const contentOne = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "First checkpoint" }] }] };
    const contentTwo = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Second checkpoint" }] }] };
    await agent.put(`/api/pages/${created.id}`).send({ title: "Draft one", content: contentOne, version: 1 });
    await agent.put(`/api/pages/${created.id}`).send({ title: "Draft two", content: contentTwo, version: 2 });

    const history = await agent.get(`/api/pages/${created.id}/revisions`);
    expect(history.body).toHaveLength(2);
    expect(history.body[0]).toMatchObject({ title: "Draft two", reason: "save", author: "Jane Chen" });
    const original = history.body.find((revision: { reason: string }) => revision.reason === "created");

    const restored = await agent.post(`/api/pages/${created.id}/revisions/${original.id}/restore`).send({ version: 3 });
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ title: "Original", version: 4 });
    const afterRestore = await agent.get(`/api/pages/${created.id}/revisions`);
    expect(afterRestore.body).toHaveLength(3);
    expect(afterRestore.body[0]).toMatchObject({ title: "Original", reason: "restore" });
    expect(afterRestore.body.some((revision: { title: string }) => revision.title === "Draft two")).toBe(true);
  });

  it("retains hierarchy, ordering, search, and revisions after reopening SQLite", async () => {
    const first = testApp();
    const agent = await setupAgent(first.app);
    const root = (await agent.post("/api/pages").send({ title: "Platform" })).body;
    const child = (await agent.post("/api/pages").send({
      title: "Release process", parentId: root.id,
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Persistent canary notes" }] }] },
    })).body;
    await agent.patch(`/api/pages/${child.id}/move`).send({ parentId: null, position: 0 });
    await agent.put(`/api/pages/${child.id}`).send({
      title: "Release process", version: 1,
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Persistent canary notes updated" }] }] },
    });

    first.database.close();
    cleanup.splice(cleanup.findIndex((item) => item.database === first.database), 1);
    const reopened = openDatabase(first.dataDirectory);
    cleanup.push({ directory: first.dataDirectory, database: reopened });
    const login = request.agent(createApp(reopened));
    await login.post("/api/login").send({ email: "jane@example.com", password: "a very safe password" });
    const bootstrap = await login.get("/api/bootstrap");
    expect(bootstrap.body.pages.filter((page: { parentId: string | null }) => page.parentId === null).map((page: { title: string }) => page.title)).toEqual(["Release process", "Platform"]);
    expect((await login.get("/api/search?q=canary")).body[0].id).toBe(child.id);
    expect((await login.get(`/api/pages/${child.id}/revisions`)).body).toHaveLength(2);
  });
});

describe("local files and media", () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("test image payload"),
  ]);

  it("stores validated image bytes and metadata, then serves them only to authenticated members", async () => {
    const { app, dataDirectory, database } = testApp();
    const agent = await setupAgent(app);
    const page = (await agent.post("/api/pages").send({ title: "Screenshots" })).body;

    const uploaded = await agent.post(`/api/pages/${page.id}/uploads`)
      .set("Content-Type", "image/png")
      .set("X-File-Name", encodeURIComponent("release screenshot.png"))
      .send(png);

    expect(uploaded.status).toBe(201);
    expect(uploaded.body).toMatchObject({
      pageId: page.id,
      originalName: "release screenshot.png",
      mimeType: "image/png",
      size: png.length,
      isImage: true,
    });
    expect(uploaded.body.url).toBe(`/api/uploads/${uploaded.body.id}`);

    const metadata = database.prepare("SELECT storage_name AS storageName FROM uploads WHERE id = ?").get(uploaded.body.id) as { storageName: string };
    expect(metadata.storageName).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(fs.readFileSync(path.join(dataDirectory, "uploads", metadata.storageName))).toEqual(png);
    expect((await request(app).get(uploaded.body.url)).status).toBe(401);
    const download = await agent.get(uploaded.body.url);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toMatch(/^image\/png/);
    expect(download.headers["x-content-type-options"]).toBe("nosniff");
    expect(download.body).toEqual(png);
  });

  it("persists attachments across restart and cleans their bytes up with the page", async () => {
    const first = testApp();
    const agent = await setupAgent(first.app);
    const page = (await agent.post("/api/pages").send({ title: "Runbook" })).body;
    const pdf = Buffer.from("%PDF-1.7\nconf simple test");
    const uploaded = await agent.post(`/api/pages/${page.id}/uploads`)
      .set("Content-Type", "application/pdf")
      .set("X-File-Name", encodeURIComponent("runbook.pdf"))
      .send(pdf);
    expect(uploaded.status).toBe(201);
    const stored = first.database.prepare("SELECT storage_name AS storageName FROM uploads WHERE id = ?").get(uploaded.body.id) as { storageName: string };
    const storedPath = path.join(first.dataDirectory, "uploads", stored.storageName);
    expect(fs.existsSync(storedPath)).toBe(true);

    first.database.close();
    cleanup.splice(cleanup.findIndex((item) => item.database === first.database), 1);
    const reopened = openDatabase(first.dataDirectory);
    cleanup.push({ directory: first.dataDirectory, database: reopened });
    const restarted = request.agent(createApp(reopened, { dataDirectory: first.dataDirectory }));
    await restarted.post("/api/login").send({ email: "jane@example.com", password: "a very safe password" });
    const download = await restarted.get(uploaded.body.url);
    expect(download.status).toBe(200);
    expect(download.headers["content-disposition"]).toContain("runbook.pdf");
    expect(download.body).toEqual(pdf);

    expect((await restarted.delete(`/api/pages/${page.id}`)).status).toBe(200);
    expect(fs.existsSync(storedPath)).toBe(false);
    expect((reopened.prepare("SELECT COUNT(*) AS count FROM uploads").get() as { count: number }).count).toBe(0);
  });

  it("rejects spoofed types, unsupported content, oversized files, and unsafe storage paths", async () => {
    const { app, dataDirectory } = testApp();
    const agent = await setupAgent(app);
    const page = (await agent.post("/api/pages").send({ title: "Files" })).body;
    const spoofed = await agent.post(`/api/pages/${page.id}/uploads`)
      .set("Content-Type", "image/png")
      .set("X-File-Name", "payload.png")
      .send(Buffer.from("<script>alert(1)</script>"));
    expect(spoofed.status).toBe(400);
    expect(spoofed.body.error).toMatch(/contents/);

    expect(() => validateUpload(Buffer.alloc(MAX_UPLOAD_BYTES + 1), "text/plain", "large.txt")).toThrow(/10 MB/);
    expect(() => new LocalUploadStorage(dataDirectory).resolve("../../database.sqlite")).toThrow(/Invalid stored file/);
  });

  it("removes a newly uploaded file through the explicit cleanup endpoint", async () => {
    const { app, dataDirectory, database } = testApp();
    const agent = await setupAgent(app);
    const page = (await agent.post("/api/pages").send({ title: "Draft" })).body;
    const uploaded = await agent.post(`/api/pages/${page.id}/uploads`)
      .set("Content-Type", "text/plain")
      .set("X-File-Name", "draft.txt")
      .send(Buffer.from("draft attachment"));
    const row = database.prepare("SELECT storage_name AS storageName FROM uploads WHERE id = ?").get(uploaded.body.id) as { storageName: string };
    expect((await agent.delete(uploaded.body.url)).status).toBe(204);
    expect(fs.existsSync(path.join(dataDirectory, "uploads", row.storageName))).toBe(false);
    expect((await agent.get(uploaded.body.url)).status).toBe(404);
  });

  it("does not let draft cleanup delete a file referenced by page content", async () => {
    const { app } = testApp();
    const agent = await setupAgent(app);
    const page = (await agent.post("/api/pages").send({ title: "Published" })).body;
    const uploaded = await agent.post(`/api/pages/${page.id}/uploads`)
      .set("Content-Type", "text/plain")
      .set("X-File-Name", "published.txt")
      .send(Buffer.from("published attachment"));
    await agent.put(`/api/pages/${page.id}`).send({
      title: "Published",
      version: 1,
      content: { type: "doc", content: [{ type: "fileAttachment", attrs: { url: uploaded.body.url, name: "published.txt", size: 20 } }] },
    });

    const deletion = await agent.delete(uploaded.body.url);
    expect(deletion.status).toBe(409);
    expect((await agent.get(uploaded.body.url)).status).toBe(200);
  });

  it("rejects unsafe, missing, and cross-page media references", async () => {
    const { app } = testApp();
    const agent = await setupAgent(app);
    const firstPage = (await agent.post("/api/pages").send({ title: "First" })).body;
    const secondPage = (await agent.post("/api/pages").send({ title: "Second" })).body;
    const uploaded = await agent.post(`/api/pages/${firstPage.id}/uploads`)
      .set("Content-Type", "image/png")
      .set("X-File-Name", "safe.png")
      .send(png);

    const unsafe = await agent.put(`/api/pages/${firstPage.id}`).send({
      title: "First",
      version: 1,
      content: { type: "doc", content: [{ type: "fileAttachment", attrs: { url: "javascript:alert(1)", name: "unsafe", size: 1 } }] },
    });
    expect(unsafe.status).toBe(400);

    const crossPage = await agent.put(`/api/pages/${secondPage.id}`).send({
      title: "Second",
      version: 1,
      content: { type: "doc", content: [{ type: "image", attrs: { src: uploaded.body.url, alt: "wrong page" } }] },
    });
    expect(crossPage.status).toBe(400);
  });
});

describe("workspace members and settings", () => {
  it("creates an expiring invitation link and accepts it only once", async () => {
    const { app, database } = testApp();
    const admin = await setupAgent(app);
    const invited = await admin.post("/api/invitations").send({ email: "dev@example.com", role: "member" });
    expect(invited.status).toBe(201);
    expect(invited.body.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(invited.body.expiresAt).toBeTruthy();
    const stored = database.prepare("SELECT token_hash AS tokenHash FROM workspace_invitations").get() as { tokenHash: string };
    expect(stored.tokenHash).not.toBe(invited.body.token);
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    const details = await request(app).get(`/api/invitations/${invited.body.token}`);
    expect(details.body).toMatchObject({ workspaceName: "Acme Engineering", email: "dev@example.com", role: "member", accountExists: false });
    const member = request.agent(app);
    const accepted = await member.post("/api/invitations/accept").send({
      token: invited.body.token, displayName: "Dev User", password: "another safe password",
    });
    expect(accepted.status).toBe(201);
    expect(accepted.body.workspace.role).toBe("member");
    expect((await member.get("/api/bootstrap")).body.user.email).toBe("dev@example.com");
    expect((await request(app).post("/api/invitations/accept").send({
      token: invited.body.token, displayName: "Replay User", password: "another safe password",
    })).status).toBe(404);
  });

  it("keeps management admin-only while members retain page editing rights", async () => {
    const { app } = testApp();
    const admin = await setupAgent(app);
    const { agent: member, member: memberUser } = await acceptInvite(app, admin, {
      email: "member@example.com", displayName: "Team Member", password: "member safe password",
    });

    const listed = await member.get("/api/members");
    expect(listed.status).toBe(200);
    expect(listed.body.map((item: { email: string }) => item.email)).toEqual(["jane@example.com", "member@example.com"]);
    expect((await member.post("/api/invitations").send({ email: "blocked@example.com", role: "member" })).status).toBe(403);
    expect((await member.patch("/api/workspace").send({ name: "Blocked rename" })).status).toBe(403);
    expect((await member.patch(`/api/members/${memberUser.id}`).send({ role: "admin" })).status).toBe(403);
    expect((await member.delete(`/api/members/${memberUser.id}`)).status).toBe(403);

    const page = await member.post("/api/pages").send({ title: "Member runbook" });
    expect(page.status).toBe(201);
    expect((await member.put(`/api/pages/${page.body.id}`).send({
      title: "Member-authored runbook", version: 1,
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Team-owned docs" }] }] },
    })).status).toBe(200);
  });

  it("changes roles, renames the workspace, and revokes removed member sessions", async () => {
    const { app } = testApp();
    const admin = await setupAgent(app);
    const adminBootstrap = await admin.get("/api/bootstrap");
    const adminId = adminBootstrap.body.user.id;
    const { agent: member, member: memberUser } = await acceptInvite(app, admin, {
      email: "second@example.com", displayName: "Second Admin", password: "second safe password",
    });

    expect((await admin.patch(`/api/members/${memberUser.id}`).send({ role: "admin" })).status).toBe(200);
    expect((await admin.patch(`/api/members/${adminId}`).send({ role: "member" })).body.error).toMatch(/another admin/i);
    const renamed = await admin.patch("/api/workspace").send({ name: "Platform Docs" });
    expect(renamed.status).toBe(200);
    expect((await member.get("/api/bootstrap")).body.workspace.name).toBe("Platform Docs");

    expect((await admin.patch(`/api/members/${memberUser.id}`).send({ role: "member" })).status).toBe(200);
    expect((await admin.delete(`/api/members/${memberUser.id}`)).status).toBe(204);
    expect((await member.get("/api/bootstrap")).body).toEqual({ needsSetup: false, requiresAuth: true });
    expect((await request(app).post("/api/login").send({ email: "second@example.com", password: "second safe password" })).status).toBe(403);
    expect((await admin.delete(`/api/members/${adminId}`)).body.error).toMatch(/own account/i);
  });

  it("prevents a workspace from losing its last admin", async () => {
    const { app } = testApp();
    const admin = await setupAgent(app);
    const current = (await admin.get("/api/bootstrap")).body.user;
    const demotion = await admin.patch(`/api/members/${current.id}`).send({ role: "member" });
    expect(demotion.status).toBe(409);
    expect((await admin.get("/api/bootstrap")).body.workspace.role).toBe("admin");
  });

  it("lets a removed account securely rejoin using its existing password", async () => {
    const { app } = testApp();
    const admin = await setupAgent(app);
    const first = await acceptInvite(app, admin, {
      email: "returning@example.com", displayName: "Returning User", password: "returning safe password",
    });
    expect((await admin.delete(`/api/members/${first.member.id}`)).status).toBe(204);
    const reinvite = await admin.post("/api/invitations").send({ email: "returning@example.com", role: "member" });
    const details = await request(app).get(`/api/invitations/${reinvite.body.token}`);
    expect(details.body).toMatchObject({ accountExists: true, displayName: "Returning User" });
    expect((await request(app).post("/api/invitations/accept").send({
      token: reinvite.body.token, displayName: "Returning User", password: "wrong password",
    })).status).toBe(401);
    expect((await request(app).post("/api/invitations/accept").send({
      token: reinvite.body.token, displayName: "Returning User", password: "returning safe password",
    })).status).toBe(201);
  });
});
