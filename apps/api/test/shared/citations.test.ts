import { describe, it, expect } from "vitest";
import { citationText } from "@discharge-guide/shared-types";

describe("citationText", () => {
  it("cites a single line in the singular", () => {
    expect(citationText([4])).toBe("Based on line 4 of your document.");
  });

  it("joins two lines with 'and'", () => {
    expect(citationText([4, 7])).toBe("Based on lines 4 and 7 of your document.");
  });

  it("uses a serial comma for three or more lines", () => {
    expect(citationText([4, 7, 9])).toBe(
      "Based on lines 4, 7, and 9 of your document.",
    );
  });

  it("sorts lines into document order", () => {
    expect(citationText([9, 4, 7])).toBe(
      "Based on lines 4, 7, and 9 of your document.",
    );
  });

  it("de-duplicates repeated line numbers", () => {
    expect(citationText([4, 4, 7])).toBe(
      "Based on lines 4 and 7 of your document.",
    );
  });

  it("returns null when there is nothing to cite", () => {
    // An ungrounded answer must not render a citation at all.
    expect(citationText([])).toBeNull();
    expect(citationText(undefined)).toBeNull();
    expect(citationText(null)).toBeNull();
  });
});
