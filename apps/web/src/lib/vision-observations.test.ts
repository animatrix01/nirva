import { describe, expect, it } from "vitest";
import { splitObservations } from "./vision-observations";

describe("splitObservations", () => {
  it("splits lines and strips bullet/number markers", () => {
    expect(
      splitObservations(
        "- Visible fluid at lower flange.\n2. Surface corrosion on valve body.\n• Gauge reads ~145 PSI.",
      ),
    ).toEqual([
      "Visible fluid at lower flange.",
      "Surface corrosion on valve body.",
      "Gauge reads ~145 PSI.",
    ]);
  });

  it("drops empty lines and keeps plain sentences", () => {
    expect(
      splitObservations("\nNo structural deformation.\n\n"),
    ).toEqual(["No structural deformation."]);
  });

  it("returns empty for blank input", () => {
    expect(splitObservations("  \n ")).toEqual([]);
  });
});
