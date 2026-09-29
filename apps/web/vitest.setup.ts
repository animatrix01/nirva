import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { installFetchStub } from "@/test-mocks/fetch-stub";

// jsdom has no font loader and no font files, so next/font's returned
// descriptor is never hydrated. Stub it to a plain class name — components only
// ever use `.className` / `.variable` / `.style.fontFamily`.
vi.mock("next/font/local", () => ({
  default: (opts: { variable?: string } = {}) => ({
    className: "font-inter",
    variable: opts.variable ?? "",
    style: { fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" },
  }),
}));

vi.mock("next/font/google", () => {
  const font = (opts: { variable?: string } = {}) => ({
    className: "font-sans",
    variable: opts.variable ?? "",
    style: { fontFamily: "ui-monospace, monospace" },
  });
  return { __esModule: true, default: font, Inter: font, Geist_Mono: font, Geist: font };
});

installFetchStub();

afterEach(() => {
  cleanup();
});
