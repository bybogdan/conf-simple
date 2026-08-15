import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandLockup, BrandMark } from "./BrandMark";

describe("Pagecairn identity", () => {
  it("renders the canonical mark as decorative by default", () => {
    const markup = renderToStaticMarkup(<BrandMark className="brand-mark" />);
    expect(markup).toContain('viewBox="0 0 24 24"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("#ff6b00");
  });

  it("can expose an accessible label when the mark stands alone", () => {
    const markup = renderToStaticMarkup(<BrandMark label="Pagecairn" />);
    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Pagecairn"');
    expect(markup).not.toContain("aria-hidden");
  });

  it("uses the exact product name in the lockup", () => {
    expect(renderToStaticMarkup(<BrandLockup />)).toContain("Pagecairn");
  });
});
