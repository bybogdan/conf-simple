import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { openDatabase, type AppDatabase } from "./database.js";

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
