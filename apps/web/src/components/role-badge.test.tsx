import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoleBadge, roleLabel } from "@/components/role-badge";

describe("RoleBadge", () => {
  it("renders human labels for all four roles", () => {
    expect(roleLabel("engineer")).toBe("Engineer");
    expect(roleLabel("safety_officer")).toBe("Safety Officer");
    expect(roleLabel("supervisor")).toBe("Supervisor");
    expect(roleLabel("admin")).toBe("Admin");
  });

  it("falls back to raw value for unknown roles", () => {
    expect(roleLabel("mystery")).toBe("mystery");
    render(<RoleBadge role="safety_officer" />);
    expect(screen.getByText("Safety Officer")).toBeInTheDocument();
  });
});
