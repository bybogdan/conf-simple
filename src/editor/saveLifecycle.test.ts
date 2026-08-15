import { describe, expect, it, vi } from "vitest";
import { runEditorSave } from "./saveLifecycle";

describe("editor save lifecycle", () => {
  it("returns to idle after a successful save so the page can be edited again", async () => {
    const savingStates: boolean[] = [];
    const onSaved = vi.fn();

    await runEditorSave({
      save: async () => ({ id: "page-1" }),
      onSaved,
      onError: vi.fn(),
      setSaving: (saving) => savingStates.push(saving),
    });

    expect(onSaved).toHaveBeenCalledWith({ id: "page-1" });
    expect(savingStates).toEqual([true, false]);
  });

  it("also returns to idle and reports the error after a failed save", async () => {
    const savingStates: boolean[] = [];
    const onError = vi.fn();

    await runEditorSave({
      save: async () => { throw new Error("Save failed"); },
      onSaved: vi.fn(),
      onError,
      setSaving: (saving) => savingStates.push(saving),
    });

    expect(onError).toHaveBeenCalledWith("Save failed");
    expect(savingStates).toEqual([true, false]);
  });
});
