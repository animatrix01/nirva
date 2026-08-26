import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("home page", () => {
  it("renders the NIRVA heading", () => {
    render(<Home />);
    expect(screen.getByText(/NIRVA/i)).toBeInTheDocument();
  });
});
