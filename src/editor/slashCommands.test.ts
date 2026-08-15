import { describe, expect, it } from "vitest";
import { filterSlashCommands, findSlashMatch } from "./slashCommands";

describe("slash command matching", () => {
  it("opens for a slash at the start of a text block", () => {
    expect(findSlashMatch("/", 10, 11)).toEqual({ query: "", range: { from: 10, to: 11 } });
  });

  it("keeps preceding whitespace outside the replacement range", () => {
    expect(findSlashMatch("Intro /head", 4, 15)).toEqual({ query: "head", range: { from: 10, to: 15 } });
  });

  it("closes for a slash embedded in a word or an invalid query", () => {
    expect(findSlashMatch("https://", 1, 9)).toBeNull();
    expect(findSlashMatch("/heading!", 1, 10)).toBeNull();
  });

  it("filters by labels, descriptions, and aliases", () => {
    expect(filterSlashCommands("head").map((command) => command.label)).toEqual(["Heading 1", "Heading 2", "Heading 3"]);
    expect(filterSlashCommands("todo").map((command) => command.label)).toEqual(["Checklist"]);
    expect(filterSlashCommands("ordered").map((command) => command.label)).toEqual(["Numbered list"]);
    expect(filterSlashCommands("photo").map((command) => command.label)).toEqual(["Image"]);
    expect(filterSlashCommands("attachment").map((command) => command.label)).toEqual(["File"]);
    expect(filterSlashCommands("url").map((command) => command.label)).toEqual(["Link"]);
    expect(filterSlashCommands("grid").map((command) => command.label)).toEqual(["Table"]);
    expect(filterSlashCommands("monospace").map((command) => command.label)).toEqual(["Inline code"]);
  });
});
