import { describe, expect, it } from "vitest";
import { parseCitation } from "@/lib/citation";

describe("parseCitation (§c.5)", () => {
  it("parses the frozen four-part format", () => {
    const parsed = parseCitation(
      "[OEM Manual Centrifugal Pumps, rev C, page 41, chunk_oem_p41]"
    );
    expect(parsed).toEqual({
      title: "OEM Manual Centrifugal Pumps",
      revision: "rev C",
      locator: "page 41",
      chunkId: "chunk_oem_p41",
      raw: "[OEM Manual Centrifugal Pumps, rev C, page 41, chunk_oem_p41]",
    });
  });

  it("handles section locators", () => {
    const parsed = parseCitation("[WO-88712, rev 2, section 3.2, chunk_wo88712_s32]");
    expect(parsed?.locator).toBe("section 3.2");
  });

  it("returns null for malformed citations", () => {
    expect(parseCitation("no brackets")).toBeNull();
    expect(parseCitation("[only, three, parts]")).toBeNull();
    expect(parseCitation("[a, b, , d]")).toBeNull();
  });
});
