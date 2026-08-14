import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { User, Workspace } from "../types";
import { MembersPage } from "./MembersPage";
import { SettingsPage } from "./SettingsPage";

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
});
