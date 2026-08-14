import { describe, expect, it } from "vitest";
import { invitationToken } from "./App";

describe("invitation path parsing", () => {
  it("decodes a valid invitation token", () => {
    expect(invitationToken("/invite/member%2Dtoken_123")).toBe("member-token_123");
    expect(invitationToken("/invite/member-token_123/")).toBe("member-token_123");
  });

  it("keeps malformed encoding in the invalid-invitation flow without throwing", () => {
    expect(() => invitationToken("/invite/%E0%A4%A")).not.toThrow();
    expect(invitationToken("/invite/%E0%A4%A")).toBe("%E0%A4%A");
  });

  it("ignores paths that are not invitation routes", () => {
    expect(invitationToken("/members")).toBeNull();
  });
});
