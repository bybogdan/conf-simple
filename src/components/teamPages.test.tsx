import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Page, User, Workspace } from "../types";
import { MembersPage } from "./MembersPage";
import { SettingsPage } from "./SettingsPage";
import { PageRows } from "./WorkspaceShell";

const user: User = { id: "user-1", displayName: "Jane Chen", email: "jane@example.com" };

describe("team management UI permissions", () => {
  it("shows invitation and member management controls only to admins", () => {
    const admin: Workspace = { id: "workspace-1", name: "Acme Engineering", role: "admin" };
    const member: Workspace = { ...admin, role: "member" };

    const adminMarkup = renderToStaticMarkup(<MembersPage user={user} workspace={admin} />);
    const memberMarkup = renderToStaticMarkup(<MembersPage user={user} workspace={member} />);

    expect(adminMarkup).toContain("Invite member");
    expect(adminMarkup).toContain("Invite with a link");
    expect(memberMarkup).not.toContain("Invite member");
    expect(memberMarkup).not.toContain("Invite with a link");
    expect(memberMarkup).toContain("Only admins can manage members");
  });

  it("renders workspace settings as read-only for members", () => {
    const admin: Workspace = { id: "workspace-1", name: "Acme Engineering", role: "admin" };
    const member: Workspace = { ...admin, role: "member" };

    const adminMarkup = renderToStaticMarkup(<SettingsPage workspace={admin} onWorkspaceChange={() => undefined} />);
    const memberMarkup = renderToStaticMarkup(<SettingsPage workspace={member} onWorkspaceChange={() => undefined} />);

    expect(adminMarkup).not.toContain("Only workspace admins can change these settings");
    expect(memberMarkup).toContain("Only workspace admins can change these settings");
    expect(memberMarkup).toMatch(/<input[^>]+disabled=""/);
  });

  it("shows permanent page deletion only to admins", () => {
    const page: Page = {
      id: "page-1", parentId: null, title: "Runbook", content: { type: "doc" }, position: 0, version: 1,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", updatedBy: "Jane Chen",
    };
    const baseProps = {
      pages: [page], parentId: null, selectedId: page.id, expanded: new Set<string>(), menuId: page.id,
      onSelect: () => undefined, onToggle: () => undefined, onMenu: () => undefined, onAddChild: () => undefined,
      onMoveTarget: () => undefined, onMove: async () => undefined, onDelete: async () => undefined,
    };

    const adminMarkup = renderToStaticMarkup(<>{PageRows({ ...baseProps, canDelete: true })}</>);
    const memberMarkup = renderToStaticMarkup(<>{PageRows({ ...baseProps, canDelete: false })}</>);

    expect(adminMarkup).toContain("Delete page");
    expect(memberMarkup).not.toContain("Delete page");
    expect(memberMarkup).toContain("Move to…");
  });
});
